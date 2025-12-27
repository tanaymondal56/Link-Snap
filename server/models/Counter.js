import mongoose from 'mongoose';

/**
 * Counter collection for atomic sequence generation
 * Used for Elite ID system to ensure unique, sequential IDs
 */
const counterSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true
  },
  // User sequence (for Pioneer, Torchbearer, etc.)
  userSeq: {
    type: Number,
    default: 0
  },
  // Admin sequence (for root-N IDs)
  adminSeq: {
    type: Number,
    default: 0
  },
  // Snap ID global sequence (for Hashids)
  snapSeq: {
    type: Number,
    default: 0
  }
});

/**
 * Get next sequence number atomically
 * @param {string} type - 'user', 'admin', or 'snap'
 * @returns {Promise<number>} Next sequence number
 */
counterSchema.statics.getNextSequence = async function(type = 'user') {
  let field;
  if (type === 'admin') field = 'adminSeq';
  else if (type === 'snap') field = 'snapSeq';
  else field = 'userSeq';
  
  const counter = await this.findOneAndUpdate(
    { _id: 'elite_id' },
    { $inc: { [field]: 1 } },
    { 
      returnDocument: 'after',
      upsert: true
    }
  );
  
  return counter[field];
};

/**
 * Get current sequence values without incrementing
 */
counterSchema.statics.getCurrentSequences = async function() {
  const counter = await this.findOne({ _id: 'elite_id' });
  return {
    userSeq: counter?.userSeq || 0,
    adminSeq: counter?.adminSeq || 0,
    snapSeq: counter?.snapSeq || 0
  };
};

/**
 * Initialize counter with specific values (for migration)
 */
counterSchema.statics.initializeCounter = async function(userSeq, adminSeq, snapSeq = 0) {
  const update = { userSeq, adminSeq };
  if (snapSeq !== undefined) update.snapSeq = snapSeq;

  await this.findOneAndUpdate(
    { _id: 'elite_id' },
    { $set: update },
    { upsert: true }
  );
};

const Counter = mongoose.model('Counter', counterSchema);

export default Counter;
