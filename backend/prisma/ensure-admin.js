require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error('ADMIN_EMAIL y ADMIN_PASSWORD son obligatorios para iniciar el servicio');
  }

  if (password.length < 12) {
    throw new Error('ADMIN_PASSWORD debe contener al menos 12 caracteres');
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  const passwordIsCurrent = existingUser
    ? await bcrypt.compare(password, existingUser.password)
    : false;

  if (existingUser && passwordIsCurrent && existingUser.role === 'admin') {
    console.log(`ℹ️ Usuario administrador disponible: ${email}`);
    return;
  }

  const hashedPassword = passwordIsCurrent
    ? existingUser.password
    : await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    update: {
      password: hashedPassword,
      name: existingUser?.name || 'Administrador',
      role: 'admin',
    },
    create: {
      email,
      password: hashedPassword,
      name: 'Administrador',
      role: 'admin',
    },
  });

  console.log(existingUser
    ? `✅ Usuario administrador actualizado: ${email}`
    : `✅ Usuario administrador creado: ${email}`);
}

main()
  .catch(error => {
    console.error('❌ No fue posible preparar el administrador:', error.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
