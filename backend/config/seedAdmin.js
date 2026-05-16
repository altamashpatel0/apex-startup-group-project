const Admin = require('../models/Admin');

/**
 * Seeds a default admin from environment variables if no admin exists.
 * Called once on server startup.
 */
const seedAdmin = async () => {
  try {
    const count = await Admin.countDocuments();
    if (count > 0) return; // admins already exist – skip

    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    const name = process.env.ADMIN_NAME || 'Super Admin';

    if (!email || !password) {
      console.warn('⚠️  ADMIN_EMAIL / ADMIN_PASSWORD not set in .env – skipping admin seed.');
      return;
    }

    await Admin.create({ name, email, password, role: 'superadmin' });
    console.log(`✅ Default admin seeded → ${email}`);
  } catch (err) {
    console.error('❌ Admin seed failed:', err.message);
  }
};

module.exports = seedAdmin;
