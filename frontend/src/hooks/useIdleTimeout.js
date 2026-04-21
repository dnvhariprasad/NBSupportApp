import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const useIdleTimeout = (warningTime = 30000, logoutTime = 60000) => {
  const navigate = useNavigate();
  const [showWarning, setShowWarning] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);

  const idleTimerRef = useRef(null);
  const warningTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const isIdleRef = useRef(false);

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
  };

  const resetIdleTimer = () => {
    if (showWarning) return;

    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);

    isIdleRef.current = false;

    idleTimerRef.current = setTimeout(() => {
      isIdleRef.current = true;
      setShowWarning(true);
      setRemainingTime(warningTime);

      countdownTimerRef.current = setInterval(() => {
        setRemainingTime(prev => {
          if (prev <= 1000) {
            clearInterval(countdownTimerRef.current);
            handleLogout();
            return 0;
          }
          return prev - 1000;
        });
      }, 1000);
    }, logoutTime - warningTime);
  };

  const handleContinue = () => {
    setShowWarning(false);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    resetIdleTimer();
  };

  useEffect(() => {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

    const handleActivity = () => {
      if (!isIdleRef.current) return;
      handleContinue();
    };

    events.forEach(event => {
      document.addEventListener(event, handleActivity);
    });

    resetIdleTimer();

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, []);

  return { showWarning, remainingTime, handleContinue };
};

export default useIdleTimeout;
