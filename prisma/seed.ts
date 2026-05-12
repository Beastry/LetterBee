import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const cities = [
  { name: "深圳", country: "中国", latitude: 22.5431, longitude: 114.0579 },
  { name: "成都", country: "中国", latitude: 30.5728, longitude: 104.0668 },
  { name: "北京", country: "中国", latitude: 39.9042, longitude: 116.4074 },
  { name: "上海", country: "中国", latitude: 31.2304, longitude: 121.4737 },
  { name: "广州", country: "中国", latitude: 23.1291, longitude: 113.2644 },
];

async function main() {
  for (const city of cities) {
    const savedCity = await prisma.city.upsert({
      where: { name_country: { name: city.name, country: city.country } },
      update: city,
      create: city,
    });

    await prisma.postOffice.upsert({
      where: { cityId_name: { cityId: savedCity.id, name: `${city.name}中央邮政局` } },
      update: {
        latitude: city.latitude,
        longitude: city.longitude,
      },
      create: {
        cityId: savedCity.id,
        name: `${city.name}中央邮政局`,
        latitude: city.latitude,
        longitude: city.longitude,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
