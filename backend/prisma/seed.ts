import { prisma } from "../src/lib/prisma.js";

const AMENITIES = [
  // ── BUILDING ──
  ["Lift", "BUILDING"],
  ["Service Lift", "BUILDING"],
  ["Power Backup", "BUILDING"],
  ["DG Backup", "BUILDING"],
  ["Maintenance Staff", "BUILDING"],
  ["Water Storage", "BUILDING"],
  ["Sewage Treatment Plant", "BUILDING"],
  ["Rain Water Harvesting", "BUILDING"],
  ["Waste Disposal", "BUILDING"],
  ["Solar Power", "BUILDING"],
  ["Piped Gas", "BUILDING"],

  // ── SECURITY ──
  ["24x7 Security", "SECURITY"],
  ["CCTV Surveillance", "SECURITY"],
  ["Gated Community", "SECURITY"],
  ["Intercom Facility", "SECURITY"],
  ["Fire Safety", "SECURITY"],
  ["Security Guard", "SECURITY"],
  ["Video Door Phone", "SECURITY"],

  // ── PARKING ──
  ["Covered Parking", "PARKING"],
  ["Open Parking", "PARKING"],
  ["Two Wheeler Parking", "PARKING"],
  ["Reserved Parking", "PARKING"],
  ["Visitor Parking", "PARKING"],

  // ── RECREATION ──
  ["Swimming Pool", "RECREATION"],
  ["Gymnasium", "RECREATION"],
  ["Club House", "RECREATION"],
  ["Park / Garden", "RECREATION"],
  ["Children's Play Area", "RECREATION"],
  ["Indoor Games Room", "RECREATION"],
  ["Jogging Track", "RECREATION"],
  ["Sports Court", "RECREATION"],
  ["Multipurpose Hall", "RECREATION"],
  ["Banquet Hall", "RECREATION"],
  ["Amphitheatre", "RECREATION"],
  ["Aerobics / Yoga Room", "RECREATION"],

  // ── UNIT ──
  ["Modular Kitchen", "UNIT"],
  ["Wardrobes", "UNIT"],
  ["Air Conditioning", "UNIT"],
  ["Geyser", "UNIT"],
  ["False Ceiling", "UNIT"],
  ["Furnished Balcony", "UNIT"],
  ["Servant Room", "UNIT"],
  ["Study Room", "UNIT"],
  ["Pooja Room", "UNIT"],
  ["Store Room", "UNIT"],
  ["Attached Bathroom", "UNIT"],
  ["Wi-Fi / Broadband", "UNIT"],
  ["Vastu Compliant", "UNIT"],
  ["Corner Property", "UNIT"],

  // ── PLOT ──
  ["Boundary Wall", "PLOT"],
  ["Corner Plot", "PLOT"],
  ["Gated Layout", "PLOT"],
  ["Electricity Connection", "PLOT"],
  ["Water Connection", "PLOT"],
  ["Borewell", "PLOT"],
  ["Approved Layout (RERA)", "PLOT"],
  ["Road Facing", "PLOT"],

  // ── COMMERCIAL ──
  ["Central Air Conditioning", "COMMERCIAL"],
  ["Conference Room", "COMMERCIAL"],
  ["Pantry", "COMMERCIAL"],
  ["Common Washrooms", "COMMERCIAL"],
  ["Reception Area", "COMMERCIAL"],
  ["Furnished Cabins", "COMMERCIAL"],
  ["Loading / Unloading Bay", "COMMERCIAL"],
  ["24x7 Access", "COMMERCIAL"],

  // ── PG ──
  ["Food Included", "PG"],
  ["Laundry Service", "PG"],
  ["Housekeeping", "PG"],
  ["Common TV / Lounge", "PG"],
  ["Study Table", "PG"],
  ["Cupboard", "PG"],
  ["Warden / Caretaker", "PG"],
] as const;

const main = async () => {
    await prisma.amenity.createMany({
  data: AMENITIES.map(([name, category]) => ({
    name,
    category,
  })),
  skipDuplicates: true,
    });
    console.log("Seeding completed");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
