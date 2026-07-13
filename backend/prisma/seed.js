require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    const message = 'ADMIN_EMAIL y ADMIN_PASSWORD son obligatorios para crear el administrador inicial';
    if (process.env.NODE_ENV === 'production') {
      throw new Error(message);
    }
    console.warn(`${message}. Se omite la creación en desarrollo.`);
    return;
  }

  if (adminPassword.length < 12) {
    throw new Error('ADMIN_PASSWORD debe tener al menos 12 caracteres');
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (existingUser) {
    console.log(`Administrador existente: ${adminEmail}`);
    return;
  }

  const hashedPassword = await bcrypt.hash(adminPassword, 12);
  await prisma.user.create({
    data: {
      email: adminEmail,
      password: hashedPassword,
      name: 'Administrador',
      role: 'admin',
    },
  });

  console.log(`Administrador creado: ${adminEmail}`);
}

main()
  .catch((error) => {
    console.error('No se pudo inicializar el administrador:', error.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
