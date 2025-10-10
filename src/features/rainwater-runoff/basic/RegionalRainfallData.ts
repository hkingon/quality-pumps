export const rainfallData = {
  "Adelaide": { "5min": 123, "10min": 105, "1hr": 52 },
  "Alice Springs": { "5min": 139, "10min": 120, "1hr": 60 },
  "Auckland": { "5min": 110, "10min": 92, "1hr": 40 },
  "Brisbane": { "5min": 251, "10min": 210, "1hr": 90 },
  "Cairns": { "5min": 282, "10min": 235, "1hr": 100 },
  "Canberra": { "5min": 137, "10min": 115, "1hr": 55 },
  "Christchurch": { "5min": 80, "10min": 65, "1hr": 30 },
  "Darwin": { "5min": 285, "10min": 240, "1hr": 110 },
  "Dunedin": { "5min": 70, "10min": 55, "1hr": 25 },
  "Gold Coast": { "5min": 246, "10min": 205, "1hr": 85 },
  "Gympie": { "5min": 228, "10min": 190, "1hr": 80 },
  "Hobart": { "5min": 99, "10min": 82, "1hr": 35 },
  "Invercargill": { "5min": 65, "10min": 50, "1hr": 22 },
  "Launceston": { "5min": 101, "10min": 85, "1hr": 36 },
  "Mackay": { "5min": 273, "10min": 225, "1hr": 95 },
  "Melbourne": { "5min": 127, "10min": 110, "1hr": 55 },
  "Napier": { "5min": 95, "10min": 75, "1hr": 32 },
  "Palmerston North": { "5min": 90, "10min": 72, "1hr": 30 },
  "Perth": { "5min": 146, "10min": 120, "1hr": 58 },
  "Sydney": { "5min": 214, "10min": 180, "1hr": 75 },
  "Sunshine Coast": { "5min": 253, "10min": 210, "1hr": 90 },
  "Toowoomba": { "5min": 189, "10min": 155, "1hr": 65 },
  "Townsville": { "5min": 260, "10min": 215, "1hr": 90 },
  "Wellington": { "5min": 100, "10min": 82, "1hr": 35 },
  "Wagga Wagga": { "5min": 140, "10min": 115, "1hr": 50 }
} as const;


export type Region = keyof typeof rainfallData | "Custom";
export type Duration = keyof (typeof rainfallData)[keyof typeof rainfallData];
