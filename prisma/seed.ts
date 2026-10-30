import { PrismaClient } from "@prisma/client";
import { cityOptions } from "../src/lib/cities";

const prisma = new PrismaClient();

async function main() {
  for (const user of [
    { email: "nearws@example.com", name: "远山", publicId: "nearws" },
    { email: "xiaocao@example.com", name: "小草", publicId: "xiaocao" },
  ]) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: { name: user.name, publicId: user.publicId },
      create: user,
    });
  }

  for (const city of cityOptions) {
    const savedCity = await prisma.city.upsert({
      where: { id: city.id },
      update: {
        name: city.name,
        country: city.country,
        latitude: city.latitude,
        longitude: city.longitude,
      },
      create: {
        id: city.id,
        name: city.name,
        country: city.country,
        latitude: city.latitude,
        longitude: city.longitude,
      },
    });

    for (const postOffice of city.postOffices) {
      await prisma.postOffice.upsert({
        where: { id: postOffice.id },
        update: {
          cityId: savedCity.id,
          name: postOffice.name,
          latitude: postOffice.latitude,
          longitude: postOffice.longitude,
        },
        create: {
          id: postOffice.id,
          cityId: savedCity.id,
          name: postOffice.name,
          latitude: postOffice.latitude,
          longitude: postOffice.longitude,
        },
      });
    }
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
