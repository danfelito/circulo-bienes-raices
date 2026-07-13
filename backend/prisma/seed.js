require('dotenv').config();
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error('Configura ADMIN_EMAIL y ADMIN_PASSWORD antes de ejecutar el seed.');
  }
  if (password.length < 12) {
    throw new Error('ADMIN_PASSWORD debe tener al menos 12 caracteres.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    console.log(`El administrador ${email} ya existe; no se modificó su contraseña.`);
    return;
  }

  await prisma.user.create({
    data: {
      email,
      password: passwordHash,
      name: 'Administrador',
      role: 'admin',
    },
  });
  console.log(`Administrador creado: ${email}`);
}

main()
  .catch((error) => {
    console.error('Seed error:', error.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
