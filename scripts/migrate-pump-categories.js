/**
 * One-time, idempotent migration: remap old pump category fields to the new taxonomy.
 *
 * WHAT THIS DOES
 * --------------
 * Reads every row from the `pumps` table and merges contributions from the OLD
 * category fields (type, configuration, pump_class, application, impeller_type,
 * phases) into the NEW taxonomy columns:
 *   - power_source                (text)
 *   - installation_configuration  (text[])
 *   - wetted_materials            (text[])  -- not populated by these rules; left as-is
 *   - pump_class                  (text[])  -- transformed in place
 *   - other_traits                (text[])  -- appended to
 *   - application                 (text[])  -- renamed in place
 *   - impeller_type               (text)    -- normalized
 * Ambiguous cases are queued into `pump_category_review` (status 'open').
 *
 * The OLD columns `type`, `configuration` and `phases` are NOT modified.
 *
 * IDEMPOTENCY
 * -----------
 * Each successfully migrated pump gets `categories_migrated_at` set to the current
 * ISO timestamp. Rows that already have `categories_migrated_at` set are skipped,
 * so this script can be safely re-run.
 *
 * HOW TO RUN
 * ----------
 *   SUPABASE_URL=...            (or NEXT_PUBLIC_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY=...
 *   node scripts/migrate-pump-categories.js
 *   # or: npm run migrate:pump-categories
 *
 * Mirrors the service-role client setup in scripts/seed-admin.js (ESM, reads env
 * vars directly from process.env, no dotenv).
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    'Missing SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables.'
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const BATCH_SIZE = 100;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalize an unknown value into a plain array (handles null/single values). */
function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [value];
}

/** Case-sensitive exact dedupe, dropping empty/null entries. */
function dedupe(arr) {
  const seen = new Set();
  const out = [];
  for (const raw of arr) {
    if (raw === null || raw === undefined) continue;
    const v = typeof raw === 'string' ? raw.trim() : raw;
    if (v === '' || v === null || v === undefined) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Per-pump migration logic
// ---------------------------------------------------------------------------

/**
 * Compute the new taxonomy values for a single pump.
 * Returns { update, reviews } where `update` is the partial row to persist and
 * `reviews` is an array of { reason } describing review items to queue.
 */
function migratePump(pump) {
  const reviews = [];

  // Accumulators (start from existing values where applicable).
  let newPumpClass = toArray(pump.pump_class);
  let newImpeller = pump.impeller_type || '';
  let newInstall = [];
  let newOtherTraits = toArray(pump.other_traits);
  let newApplication = toArray(pump.application);
  let newPowerSource = null;

  const addReview = (reason) => reviews.push({ reason });

  // ---- §5.1 — from old `type` (array) -------------------------------------
  for (const t of toArray(pump.type)) {
    switch (t) {
      case 'Centrifugal':
        // drop (ignore)
        break;
      case 'Axial':
        newPumpClass.push('Axial Flow');
        break;
      case 'Mixed Flow':
        newPumpClass.push('Mixed Flow');
        break;
      case 'Drainage Pump':
        newPumpClass.push('Drainage');
        break;
      case 'Horizontal Multistage':
        newPumpClass.push('Horizontal Multistage');
        break;
      case 'End Suction Centrifugal':
      case 'EndSuction Centrifugal':
        newPumpClass.push('End Suction');
        break;
      case 'Positive Displacement':
        addReview('Positive Displacement needs a specific PD subtype');
        // do not add a class
        break;
      case 'Submersible Vortex':
        newPumpClass.push('Sewage (Solids Handling)');
        newImpeller = 'Vortex (Recessed)';
        newInstall.push('Submersible');
        break;
      case 'Grinder':
        newPumpClass.push('Grinder');
        break;
      case 'Jet Pressure Pump':
      case 'JetPressure Pump':
        newPumpClass.push('Jet Pump');
        break;
      case 'Submersible Drainage Pump':
        newPumpClass.push('Drainage');
        newInstall.push('Submersible');
        break;
      case 'Vertical Multistage':
        newPumpClass.push('Vertical Multistage');
        break;
      default:
        // any other (custom) value
        newPumpClass.push(t);
        addReview('custom Type value migrated into Pump Class');
        break;
    }
  }

  // ---- §5.2 — from old `configuration` (array) ----------------------------
  for (const c of toArray(pump.configuration)) {
    switch (c) {
      case 'End Suction':
        newPumpClass.push('End Suction');
        break;
      case 'Split Case':
        newPumpClass.push('Split Case');
        break;
      case 'Vertical Turbine':
        newPumpClass.push('Vertical Turbine');
        break;
      case 'Inline':
        newInstall.push('Inline');
        break;
      case 'Self Priming':
      case 'Self-Priming':
        newOtherTraits.push('Self-Priming');
        break;
      case 'Single Pump':
        newInstall.push('Single Pump');
        break;
      default:
        // any other value -> install (no review)
        newInstall.push(c);
        break;
    }
  }

  // ---- §5.3 — transform existing pump_class in place ----------------------
  {
    const transformed = [];
    for (const cls of newPumpClass) {
      switch (cls) {
        case 'Self-Priming':
          newOtherTraits.push('Self-Priming');
          break; // remove from class
        case 'Vortex':
          transformed.push('Sewage (Solids Handling)');
          newImpeller = 'Vortex (Recessed)';
          break;
        case 'Solar Submersible':
          newPowerSource = 'DC (Solar)';
          newInstall.push('Submersible');
          newInstall.push('Borehole');
          addReview(
            'Solar Submersible: confirm pump class (usually Vertical Multistage or Progressive Cavity)'
          );
          break; // remove from class
        case 'Solar Surface Mount':
          newPowerSource = 'DC (Solar)';
          newInstall.push('Surface-Mounted');
          addReview('Solar Surface Mount: confirm pump class');
          break; // remove from class
        case 'Progressive Cavity':
          transformed.push('Progressive Cavity (Helical Rotor)');
          break;
        default:
          transformed.push(cls);
          break;
      }
    }
    newPumpClass = transformed;
  }

  // ---- §5.4 — rename existing application values ---------------------------
  newApplication = newApplication.map((app) => {
    switch (app) {
      case 'Borehole Supply':
      case 'Borehole':
        return 'Bore Water Supply';
      case 'Fire (AS2941)':
        return 'Fire — AS2941 Certified Systems';
      case 'Sewage':
        return 'Sewage & Wastewater';
      default:
        return app;
    }
  });

  // ---- §5.5 — normalize impeller_type -------------------------------------
  // Preserve "Vortex (Recessed)" if §5.1/§5.3 already set it.
  if (newImpeller !== 'Vortex (Recessed)') {
    if (newImpeller === '' || newImpeller === 'None') {
      newImpeller = 'N/A — No Impeller (PD pumps)';
    } else {
      switch (newImpeller) {
        case 'Channel':
          newImpeller = 'Multi-Channel';
          addReview('Channel impeller: confirm single vs multi-channel');
          break;
        case 'Axial Flow':
          newImpeller = 'Axial (Propeller)';
          break;
        case 'Vortex':
          newImpeller = 'Vortex (Recessed)';
          break;
        default:
          // unchanged
          break;
      }
    }
  }

  // ---- §5.6 — power source from numeric `phases` --------------------------
  // Only if not already set by the solar rules above.
  if (!newPowerSource) {
    if (pump.phases === 1) {
      newPowerSource = '1 Phase (230 V)';
    } else if (pump.phases === 3) {
      newPowerSource = '3 Phase (415 V)';
    } else {
      newPowerSource = null;
    }
  }

  // ---- Finalize: dedupe arrays, drop empties ------------------------------
  newPumpClass = dedupe(newPumpClass);
  newInstall = dedupe(newInstall);
  newOtherTraits = dedupe(newOtherTraits);
  newApplication = dedupe(newApplication);

  const update = {
    pump_class: newPumpClass,
    impeller_type: newImpeller,
    installation_configuration: newInstall,
    other_traits: newOtherTraits,
    application: newApplication,
    power_source: newPowerSource,
    categories_migrated_at: new Date().toISOString()
  };

  return { update, reviews };
}

/** Build the old_values jsonb snapshot for a review row. */
function oldValuesSnapshot(pump) {
  return {
    type: pump.type ?? null,
    configuration: pump.configuration ?? null,
    pump_class: pump.pump_class ?? null,
    application: pump.application ?? null,
    impeller_type: pump.impeller_type ?? null,
    phases: pump.phases ?? null
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  let migratedCount = 0;
  let reviewCount = 0;
  let skippedCount = 0;

  try {
    let from = 0;

    // Fetch and process in batches.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data: pumps, error: fetchError } = await supabase
        .from('pumps')
        .select(
          'id, model, type, configuration, pump_class, application, impeller_type, other_traits, phases, categories_migrated_at'
        )
        .order('id', { ascending: true })
        .range(from, from + BATCH_SIZE - 1);

      if (fetchError) {
        throw fetchError;
      }

      if (!pumps || pumps.length === 0) {
        break;
      }

      for (const pump of pumps) {
        // IDEMPOTENCY: skip already-migrated rows.
        if (pump.categories_migrated_at) {
          skippedCount += 1;
          continue;
        }

        const { update, reviews } = migratePump(pump);

        // Update the pump row (does NOT touch type/configuration/phases).
        const { error: updateError } = await supabase
          .from('pumps')
          .update(update)
          .eq('id', pump.id);

        if (updateError) {
          throw new Error(
            `Failed updating pump ${pump.id} (${pump.model}): ${updateError.message}`
          );
        }
        migratedCount += 1;

        // Queue any review items.
        if (reviews.length > 0) {
          const reviewRows = reviews.map((r) => ({
            pump_id: pump.id,
            pump_name: pump.model,
            reason: r.reason,
            old_values: oldValuesSnapshot(pump),
            suggested: update,
            status: 'open'
          }));

          const { error: reviewError } = await supabase
            .from('pump_category_review')
            .insert(reviewRows);

          if (reviewError) {
            throw new Error(
              `Failed inserting review rows for pump ${pump.id} (${pump.model}): ${reviewError.message}`
            );
          }
          reviewCount += reviewRows.length;
        }
      }

      console.log(
        `Progress: migrated ${migratedCount} pumps, ${reviewCount} review items, ${skippedCount} skipped (already migrated).`
      );

      // If we received fewer than a full batch, we're done.
      if (pumps.length < BATCH_SIZE) {
        break;
      }
      from += BATCH_SIZE;
    }

    console.log(
      `Migration complete. Migrated ${migratedCount} pumps, ${reviewCount} review items, ${skippedCount} skipped.`
    );
  } catch (error) {
    console.error('Error migrating pump categories:', error.message);
    process.exit(1);
  }
}

main();
