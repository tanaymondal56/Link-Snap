import mongoose from 'mongoose';

const feedbackSchema = new mongoose.Schema({
  // User who submitted (null for anonymous)
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  // Email for anonymous users or as backup
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  
  // Feedback type
  type: {
    type: String,
    enum: ['feature_request', 'bug_report', 'improvement', 'question'],
    required: true,
    default: 'feature_request'
  },
  
  // Optional category for organization
  category: {
    type: String,
    enum: ['general', 'links', 'analytics', 'ui', 'api', 'mobile', 'other'],
    default: 'general'
  },
  
  // Title - required, short summary
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  
  // Message - required, detailed description
  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true,
    maxlength: [2000, 'Message cannot exceed 2000 characters']
  },
  
  // Screenshot URL (disabled for now, field ready for future use)
  screenshot: {
    type: String,
    default: null
  },
  
  // Current status of the feedback
  status: {
    type: String,
    enum: ['new', 'under_review', 'planned', 'in_progress', 'completed', 'declined'],
    default: 'new'
  },
  
  // Priority assigned by admin
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  
  // Array of user IDs who upvoted
  votes: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    votedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Cached vote count for efficient sorting
  voteCount: {
    type: Number,
    default: 0
  },
  
  // Internal admin notes (never exposed to users)
  adminNotes: {
    type: String,
    default: ''
  },
  
  // Link to roadmap item (optional)
  linkedRoadmapItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Changelog',
    default: null
  },
  
  // User preference for notifications
  notifyOnUpdate: {
    type: Boolean,
    default: false
  },
  
  // Soft delete flag
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
feedbackSchema.index({ createdAt: -1 });
feedbackSchema.index({ voteCount: -1 });
feedbackSchema.index({ status: 1, createdAt: -1 });
feedbackSchema.index({ type: 1, createdAt: -1 });
feedbackSchema.index({ user: 1 });
feedbackSchema.index({ isDeleted: 1 });

// Virtual for checking if user has voted
feedbackSchema.methods.hasUserVoted = function(userId) {
  if (!userId) return false;
  return this.votes.some(v => v.user.toString() === userId.toString());
};

// Method to add vote (Atomic)
feedbackSchema.methods.addVote = async function(userId) {
  // Atomic update: Only update if user hasn't voted yet
  const updated = await this.constructor.findOneAndUpdate(
    { 
      _id: this._id, 
      'votes.user': { $ne: userId } 
    },
    { 
      $addToSet: { votes: { user: userId } },
      $inc: { voteCount: 1 }
    },
    { new: true }
  );

  if (!updated) {
    // If update failed, check if it was because of double-voting
    const exists = await this.constructor.findOne({ _id: this._id, 'votes.user': userId });
    if (exists) {
        throw new Error('You have already voted for this feedback');
    }
    throw new Error('Failed to add vote');
  }
  
  return updated;
};

// Method to remove vote (Atomic)
feedbackSchema.methods.removeVote = async function(userId) {
  const updated = await this.constructor.findOneAndUpdate(
    { 
      _id: this._id, 
      'votes.user': userId 
    },
    { 
      $pull: { votes: { user: userId } },
      $inc: { voteCount: -1 }
    },
    { new: true }
  );

  if (!updated) {
     throw new Error('You have not voted for this feedback');
  }

  return updated;
};

const Feedback = mongoose.model('Feedback', feedbackSchema);

export default Feedback;
