import mongoose from 'mongoose';

const testerSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'addedByModel',
      required: true,
    },
    addedByModel: {
      type: String,
      enum: ['User', 'MasterAdmin'],
      default: 'User',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

testerSchema.index({ isActive: 1, _id: -1 });

const Tester = mongoose.model('Tester', testerSchema);

export default Tester;
