"use client";

import { useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

type CalendarProps = {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
};

export function Calendar({ selectedDate, onDateSelect }: CalendarProps) {
  const [viewDate, setViewDate] = useState(new Date(selectedDate));

  const daysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (month: number, year: number) => new Date(year, month, 1).getDay();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const handlePrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const month = viewDate.getMonth();
  const year = viewDate.getFullYear();
  const daysCount = daysInMonth(month, year);
  const startDay = firstDayOfMonth(month, year);

  const days: Date[] = [];
  for (let i = 1; i <= daysCount; i++) {
    days.push(new Date(year, month, i));
  }

  return (
    <div className="p-6 bg-white rounded-3xl border border-et-border shadow-2xl w-[340px] animate-in fade-in zoom-in-95 duration-300 ease-out fill-mode-both">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex flex-col">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-et-red mb-1">Select Date</span>
          <h3 className="text-xl font-serif font-bold text-et-headline">
            {viewDate.toLocaleString("default", { month: "long", year: "numeric" })}
          </h3>
        </div>
        <div className="flex gap-1">
          <button 
            onClick={handlePrevMonth}
            className="p-2 hover:bg-et-section rounded-full transition-colors text-et-secondary hover:text-et-red"
          >
            <ChevronLeftIcon className="w-5 h-5" />
          </button>
          <button 
            onClick={handleNextMonth}
            className="p-2 hover:bg-et-section rounded-full transition-colors text-et-secondary hover:text-et-red"
          >
            <ChevronRightIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
          <div key={day} className="text-[10px] font-extrabold uppercase tracking-widest text-et-meta text-center py-2">
            {day[0]}
          </div>
        ))}
        {Array.from({ length: startDay }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {days.map(date => {
          const isSelected = selectedDate.toDateString() === date.toDateString();
          const isToday = new Date().toDateString() === date.toDateString();
          return (
            <button
              key={date.toISOString()}
              onClick={() => onDateSelect(date)}
              className={`
                aspect-square flex items-center justify-center text-sm font-bold rounded-xl transition-all duration-200 transform hover:scale-110 active:scale-90
                ${isSelected 
                  ? "bg-et-red text-white shadow-lg shadow-et-red/20 scale-105" 
                  : isToday
                    ? "text-et-red bg-et-red/5 hover:bg-et-red/10"
                    : "text-et-headline hover:bg-et-section hover:text-et-red"
                }
              `}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
