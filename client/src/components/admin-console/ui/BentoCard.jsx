const BentoCard = ({ 
  children, 
  className = '', 
  title, 
  icon: Icon,
  variant = 'default', // default, primary, danger, success
  colSpan = 1,
  rowSpan = 1
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return 'bg-blue-900/20 border-blue-500/20 hover:border-blue-500/40 hover:shadow-blue-500/10';
      case 'purple':
        return 'bg-purple-900/20 border-purple-500/20 hover:border-purple-500/40 hover:shadow-purple-500/10';
      case 'success':
        return 'bg-green-900/20 border-green-500/20 hover:border-green-500/40 hover:shadow-green-500/10';
      case 'danger':
        return 'bg-red-900/20 border-red-500/20 hover:border-red-500/40 hover:shadow-red-500/10';
      case 'gradient':
        return 'bg-gradient-to-br from-blue-900/40 to-purple-900/40 border-white/10 hover:border-white/20';
      default:
        return 'bg-gray-900/40 border-white/5 hover:border-white/10';
    }
  };

  const getSpanClasses = () => {
    const cols = {
      1: 'col-span-1',
      2: 'col-span-1 md:col-span-2',
      3: 'col-span-1 md:col-span-3'
    };
    const rows = {
      1: 'row-span-1',
      2: 'row-span-1 md:row-span-2'
    };
    return `${cols[colSpan] || 'col-span-1'} ${rows[rowSpan] || 'row-span-1'}`;
  };

  return (
    <div className={`
      relative overflow-hidden
      backdrop-blur-xl rounded-3xl border transition-all duration-300
      hover:-translate-y-1 hover:shadow-xl
      flex flex-col
      ${getVariantStyles()}
      ${getSpanClasses()}
      ${className}
    `}>
      {/* Background Glow Effect */}
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-white/5 rounded-full blur-3xl pointer-events-none" />
      
      {(title || Icon) && (
        <div className="p-6 pb-2 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className={`p-2 rounded-xl bg-white/5 text-gray-300`}>
                <Icon size={18} />
              </div>
            )}
            {title && <h3 className="text-gray-400 font-medium text-sm tracking-wide uppercase">{title}</h3>}
          </div>
        </div>
      )}
      
      <div className="p-6 pt-2 flex-1 relative z-10">
        {children}
      </div>
    </div>
  );
};

export default BentoCard;
