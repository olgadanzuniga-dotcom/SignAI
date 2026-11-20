import React from "react";
import { motion } from "framer-motion";
import { useIdioma } from "../../i18n";

export default function KidPageHeading({ title, subtitle, gradient = "from-pink-500 via-orange-400 to-emerald-500" }) {
  const { t } = useIdioma();
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="mb-8 sm:mb-10"
    >
      <h1 className="font-comic text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-2">
        <span className={`bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}>
          {t(title)}
        </span>
      </h1>
      {subtitle && (
        <p className="font-comic text-base sm:text-lg text-gray-600 dark:text-gray-300 max-w-xl mx-auto">
          {t(subtitle)}
        </p>
      )}
    </motion.div>
  );
}
