const mongoose = require('mongoose');

const validateRequiredEnv = () => {
  const missing = [];

  if (!process.env.MONGO_URI || !process.env.MONGO_URI.trim()) {
    missing.push('MONGO_URI');
  }

  if (!process.env.JWT_SECRET || !process.env.JWT_SECRET.trim()) {
    missing.push('JWT_SECRET');
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};

const connectDB = async () => {
  try {
    validateRequiredEnv();
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
