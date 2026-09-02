import { useMode } from "../../context/ModeContext.jsx";
import { FiCheck, FiShield, FiLock } from "react-icons/fi";

export default function ModeDropdown() {
  const { mode, selectMode } = useMode();

  const modes = [
    { 
      id: "trial", 
      label: "Trial Mode", 
      sublabel: "View-only simulation", 
      icon: FiShield,
      color: "text-blue-400",
      bg: "bg-blue-500/10"
    },
    { 
      id: "data", 
      label: "Data Mode", 
      sublabel: "Access real portfolio", 
      icon: FiLock,
      color: "text-green-400",
      bg: "bg-green-500/10"
    }
  ];

  return (
    <div className="bg-[#2c2c2e] rounded-xl shadow-2xl border border-white/10 overflow-hidden min-w-[200px]">
      {modes.map((m, idx) => {
        const isActive = mode === m.id;
        return (
          <button
            key={m.id}
            onClick={() => selectMode(m.id)}
            className={`w-full flex items-center justify-between p-4 transition-colors active:bg-white/5 ${
              idx !== modes.length - 1 ? 'border-b border-white/5' : ''
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${m.bg} ${m.color}`}>
                <m.icon size={18} />
              </div>
              <div className="text-left">
                <p className={`text-[15px] font-semibold ${isActive ? m.color : 'text-white'}`}>
                  {m.label}
                </p>
                <p className="text-[12px] text-gray-400">{m.sublabel}</p>
              </div>
            </div>
            {isActive && <FiCheck className={m.color} size={20} />}
          </button>
        );
      })}
    </div>
  );
}
