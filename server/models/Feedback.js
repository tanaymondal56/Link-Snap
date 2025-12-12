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

// Method to add vote
feedbackSchema.methods.addVote = async function(userId) {
  if (this.hasUserVoted(userId)) {
    throw new Error('You have already voted for this feedback');
  }
  this.votes.push({ user: userId });
  this.voteCount = this.votes.length;
  return this.save();
};

// Method to remove vote
feedbackSchema.methods.removeVote = async function(userId) {
  const initialLength = this.votes.length;
  this.votes = this.votes.filter(v => v.user.toString() !== userId.toString());
  if (this.votes.length === initialLength) {
    throw new Error('You have not voted for this feedback');
  }
  this.voteCount = this.votes.length;
  return this.save();
};

const Feedback = mongoose.model('Feedback', feedbackSchema);

export default Feedback;
