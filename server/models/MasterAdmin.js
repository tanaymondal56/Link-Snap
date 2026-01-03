import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const masterAdminSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  username: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 8,
  },
  firstName: {
    type: String,
    trim: true,
    maxlength: 50,
  },
  lastName: {
    type: String,
    trim: true,
    maxlength: 50,
  },
  avatar: {
    type: String, // Optional URL for avatar
    trim: true,
  },
  role: {
    type: String,
    default: 'master_admin',
    immutable: true, // Cannot be changed via API
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  isVerified: {
    type: Boolean,
    default: true, // Always verified
  },
  lastLoginAt: {
    type: Date,
  },
}, {
  timestamps: true,
});

// Virtual for full name (Frontend compatibility)
masterAdminSchema.virtual('fullName').get(function () {
  if (this.firstName && this.lastName) {
    return `${this.firstName} ${this.lastName}`;
  }
  return this.firstName || this.lastName || '';
});

// Encrypt password using bcrypt
// Encrypt password using bcrypt
masterAdminSchema.pre('save', function (next) {
  const user = this;
  if (!user.isModified('password')) {
    return next();
  }
  
  bcrypt.genSalt(12)
    .then(salt => bcrypt.hash(user.password, salt))
    .then(hash => {
      user.password = hash;
      next();
    })
    .catch(error => {
      next(new Error('Password encryption failed: ' + error.message));
    });
});

// Match password (Frontend compatibility)
masterAdminSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const MasterAdmin = mongoose.model('MasterAdmin', masterAdminSchema);

export default MasterAdmin;
