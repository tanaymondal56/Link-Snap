import React from 'react';
import { Hammer } from 'lucide-react';

const ComingSoonFeature = ({ title, description }) => (
  <div className="border border-white/10 rounded-xl p-6 bg-white/5 relative overflow-hidden group">
    {/* "Coming Soon" Badge */}
    <div className="absolute top-3 right-3 px-2 py-1 bg-blue-500/20 text-blue-300 text-xs font-bold uppercase rounded border border-blue-500/30">
      Coming Soon
    </div>
    
    <div className="opacity-50 blur-[1px] group-hover:blur-0 transition-all duration-500 flex flex-col items-center text-center">
        <div className="h-16 w-16 bg-gray-800/50 rounded-full border border-white/5 flex items-center justify-center mb-4">
           <Hammer className="text-gray-500" size={24} />
        </div>
        <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
        <p className="text-gray-400 text-sm">{description}</p>
    </div>
    
    {/* Interest Capture (Optional) */}
    <div className="absolute inset-0 flex items-center justify-center z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-sm">
       <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors">
         Notify Me
       </button>
    </div>
  </div>
);

export default ComingSoonFeature;
