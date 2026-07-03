import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

export default function BlurText({ text, delay = 200, direction = 'bottom' }) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setIsVisible(true); observer.disconnect(); }
    }, { threshold: 0.1 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const words = text.split(' ');
  const yStart = direction === 'bottom' ? 50 : -50;

  return (
    <span ref={ref} className="inline-block">
      {words.map((word, wordIndex) => (
        <span key={wordIndex} className="inline-block mr-[0.25em]">
          {word.split('').map((char, charIndex) => (
            <motion.span
              key={charIndex}
              initial={{ filter: 'blur(10px)', opacity: 0, y: yStart }}
              animate={isVisible ? { filter: ['blur(10px)', 'blur(5px)', 'blur(0px)'], opacity: [0, 0.5, 1], y: [yStart, -5, 0] } : {}}
              transition={{ duration: 0.35, delay: (wordIndex * words.length + charIndex) * (delay / 1000), ease: 'easeOut' }}
              className="inline-block"
            >
              {char}
            </motion.span>
          ))}
        </span>
      ))}
    </span>
  );
}