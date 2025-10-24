import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables.'
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Access auth admin api
const adminAuthClient = supabase.auth.admin;

async function seedAdmin() {
  try {
    // Check if the user already exists to avoid duplicates
    const { data: existingUser, error: checkError } =
      await adminAuthClient.getUserById('bbf5664b-ef5b-4708-8b8a-83e4e83cc5fc');
    if (checkError && checkError.code !== 'user_not_found') {
      throw checkError;
    }

    if (existingUser?.user) {
      console.log('Admin user already exists. Updating metadata...');
      // Update user_metadata if user exists
      const { data: updatedUser, error: updateError } =
        await adminAuthClient.updateUserById(existingUser.user.id, {
          user_metadata: { role: 'admin' }
        });
      if (updateError) {
        throw updateError;
      }
      console.log('Admin metadata updated:', updatedUser.user);
    } else {
      // Create the admin user with role in user_metadata
      const { data: userData, error: userError } =
        await adminAuthClient.createUser({
          email: 'hardy.king02@gmail.com',
          password: 'Sales@Quality2025',
          email_confirm: true,
          user_metadata: { role: 'admin' }
        });

      if (userError) {
        throw userError;
      }

      console.log('Admin user created:', userData.user);
    }

    console.log('Admin seeding completed successfully.');
  } catch (error) {
    console.error('Error seeding admin:', error.message);
    process.exit(1);
  }
}

seedAdmin();
