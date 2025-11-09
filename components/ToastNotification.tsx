import React, { useEffect, useState } from 'react';

interface ToastProps {
  id: number;
  message: string;
  type: 'info' | 'error' | 'success' | 'warning';
  duration?: number;
  onClose: (id: number) => void;
}

const ToastNotification: React.FC<ToastProps> = ({ id, message, type, duration = 5000, onClose }) => {
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    // Progress bar animation
    const startTime = Date.now();
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
    }, 50);

    // Auto-dismiss timer
    const timer = setTimeout(() => {
      handleClose();
    }, duration);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(timer);
    };
  }, [duration]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onClose(id);
    }, 200); // Match toast-exit animation duration
  };

  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-emerald-500/10',
          border: 'border-emerald-500/30',
          text: 'text-emerald-200',
          icon: 'text-emerald-400',
          progress: 'bg-emerald-400',
          iconPath: 'M5 13l4 4L19 7', // Checkmark
        };
      case 'error':
        return {
          bg: 'bg-red-500/10',
          border: 'border-red-500/30',
          text: 'text-red-200',
          icon: 'text-red-400',
          progress: 'bg-red-400',
          iconPath: 'M6 18L18 6M6 6l12 12', // X mark
        };
      case 'warning':
        return {
          bg: 'bg-amber-500/10',
          border: 'border-amber-500/30',
          text: 'text-amber-200',
          icon: 'text-amber-400',
          progress: 'bg-amber-400',
          iconPath: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z', // Warning triangle
        };
      case 'info':
      default:
        return {
          bg: 'bg-cyan-500/10',
          border: 'border-cyan-500/30',
          text: 'text-cyan-200',
          icon: 'text-cyan-400',
          progress: 'bg-cyan-400',
          iconPath: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', // Info circle
        };
    }
  };

  const styles = getTypeStyles();

  return (
    <div
      className={`relative overflow-hidden rounded-xl shadow-2xl border backdrop-blur-md ${styles.bg} ${styles.border} ${
        isExiting ? 'toast-exit' : 'toast-enter'
      }`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-3 p-4 pr-12">
        {/* Icon */}
        <div className={`flex-shrink-0 ${styles.icon}`}>
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d={styles.iconPath} />
          </svg>
        </div>

        {/* Message */}
        <p className={`flex-1 text-sm font-medium leading-relaxed ${styles.text}`}>
          {message}
        </p>

        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 p-1 rounded-lg hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-white/20"
          aria-label="Zavřít notifikaci"
        >
          <svg className="w-5 h-5 text-slate-400 hover:text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Progress Bar */}
      <div className="h-1 bg-slate-900/30">
        <div
          className={`h-full ${styles.progress} transition-all duration-100 ease-linear`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

interface ToastContainerProps {
  notifications: Array<{
    id: number;
    message: string;
    type: 'info' | 'error' | 'success' | 'warning';
  }>;
  onClose: (id: number) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ notifications, onClose }) => {
  return (
    <div className="fixed top-5 right-5 z-50 w-full max-w-sm space-y-3 pointer-events-none">
      <div className="space-y-3 pointer-events-auto">
        {notifications.map((notification) => (
          <ToastNotification
            key={notification.id}
            id={notification.id}
            message={notification.message}
            type={notification.type}
            onClose={onClose}
          />
        ))}
      </div>
    </div>
  );
};

export default ToastNotification;
