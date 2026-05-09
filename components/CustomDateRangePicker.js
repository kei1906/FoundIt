'use client';
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

export default function CustomDateRangePicker({ dateFrom, setDateFrom, dateTo, setDateTo }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const pickerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();

  const handlePrevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

  const formatToYYYYMMDD = (year, month, day) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const handleDateClick = (day) => {
    const dateStr = formatToYYYYMMDD(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    
    if (!dateFrom || (dateFrom && dateTo)) {
      setDateFrom(dateStr);
      setDateTo('');
    } else {
      if (dateStr < dateFrom) {
        setDateTo(dateFrom);
        setDateFrom(dateStr);
      } else {
        setDateTo(dateStr);
      }
      setIsOpen(false); // Auto-close when range selected
    }
  };

  const formatDateDisplay = (d) => {
    if (!d) return '';
    const [y, m, day] = d.split('-');
    return new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const isSelected = (day) => {
    const dateStr = formatToYYYYMMDD(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    return dateStr === dateFrom || dateStr === dateTo;
  };

  const isBetween = (day) => {
    if (!dateFrom || !dateTo) return false;
    const dateStr = formatToYYYYMMDD(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    return dateStr > dateFrom && dateStr < dateTo;
  };

  return (
    <div className="relative w-full" ref={pickerRef}>
      <button 
        type="button" 
        onClick={() => setIsOpen(!isOpen)} 
        className={`w-full flex items-center justify-between bg-white/5 border px-4 py-3 rounded-xl transition-all outline-none ${isOpen ? 'border-orange-500 bg-white/10' : 'border-white/10 hover:border-white/20'}`}
      >
        <div className="flex items-center gap-2">
          <Calendar size={14} className={dateFrom || dateTo ? "text-orange-500" : "text-white/40"} />
          <span className={dateFrom ? "text-white text-xs font-bold" : "text-white/40 text-xs font-bold"}>
            {dateFrom ? `${formatDateDisplay(dateFrom)} ${dateTo ? ` — ${formatDateDisplay(dateTo)}` : ''}` : 'Select date range...'}
          </span>
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }} 
            animate={{ opacity: 1, y: 0, scale: 1 }} 
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 sm:left-auto sm:-right-4 mt-2 p-5 bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl z-100 min-w-70"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <button type="button" onClick={handlePrevMonth} className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-colors">
                <ChevronLeft size={14} />
              </button>
              <span className="text-white text-xs font-black uppercase tracking-widest">
                {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </span>
              <button type="button" onClick={handleNextMonth} className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-colors">
                <ChevronRight size={14} />
              </button>
            </div>

            {/* Days of week */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                <div key={d} className="text-center text-[9px] font-black text-white/20 uppercase">{d}</div>
              ))}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-7 gap-y-1">
              {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`empty-${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const selected = isSelected(day);
                const between = isBetween(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handleDateClick(day)}
                    className={`w-full aspect-square flex items-center justify-center text-[11px] font-bold transition-all relative
                      ${selected ? 'bg-orange-500 text-white rounded-lg shadow-[0_0_15px_rgba(249,115,22,0.5)] z-10 scale-110' : ''}
                      ${between ? 'bg-orange-500/20 text-orange-300 rounded-none scale-100' : ''}
                      ${!selected && !between ? 'text-white/70 hover:bg-white/10 hover:text-white rounded-lg scale-100' : ''}
                    `}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center">
                <span className="text-[9px] text-white/30 uppercase tracking-widest font-bold">
                   {dateFrom && !dateTo ? 'Select end date' : ''}
                </span>
                <button 
                  type="button" 
                  onClick={() => { setDateFrom(''); setDateTo(''); }} 
                  className="text-[10px] text-white/40 hover:text-orange-400 font-bold uppercase tracking-widest transition-colors px-2 py-1 rounded hover:bg-orange-500/10"
                >
                  Clear
                </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
