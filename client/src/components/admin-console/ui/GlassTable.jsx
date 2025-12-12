const GlassTable = ({ headers, children }) => {
  return (
    <div className="w-full overflow-x-auto rounded-3xl border border-white/5 bg-gray-900/40 backdrop-blur-xl">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-white/10 text-sm font-medium text-gray-400">
            {headers.map((header, i) => (
              <th key={i} className="p-4 uppercase tracking-wider text-xs font-semibold whitespace-nowrap">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5 text-sm text-gray-300">
          {children}
        </tbody>
      </table>
    </div>
  );
};

export default GlassTable;
