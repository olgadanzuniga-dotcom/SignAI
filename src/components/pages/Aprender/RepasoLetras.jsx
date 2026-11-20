import React from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Gamepad2 } from "lucide-react";
import { abecedarioLSM } from "../../../data/abecedarioLSM";
import PageHeader from "../../common/PageHeader";
import PageLayout from "../../common/PageLayout";
import ResponsiveContainer from "../../common/ResponsiveContainer";
import { tr } from "../../../i18n";

export default function RepasoLetras() {
  const navigate = useNavigate();

  return (
    <PageLayout contentClassName="items-center justify-start text-center text-gray-900 dark:text-gray-100 pt-10 pb-16">
      <PageHeader title={tr("Repaso de letras")} />

      <ResponsiveContainer size="xl">
        <div className="mt-10 sm:mt-12 text-center">
          <h1 className="font-comic text-3xl sm:text-4xl font-bold heading-gradient mb-2">{tr("Repasa el abecedario")}</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 max-w-xl mx-auto mb-6">{tr("Toca cada tarjeta y practica la seña de cada letra.")}</p>
          <button
            onClick={() => navigate("/RepasoABC")}
            className="btn-primary rounded-full font-comic text-base sm:text-lg mx-auto"
          >
            <Gamepad2 className="w-5 h-5" />{tr("Jugar: adivina la letra")}</button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5 sm:gap-6 lg:gap-8 mt-8 sm:mt-10"
        >
          {abecedarioLSM.map(({ letra, img, color }) => (
            <motion.div
              key={letra}
              whileHover={{ scale: 1.06, rotate: -1 }}
              whileTap={{ scale: 0.96 }}
              className={`flex flex-col items-center justify-center rounded-3xl p-4 sm:p-5 aspect-square bg-gradient-to-br ${color} shadow-lg border-4 border-white`}
            >
              <img src={img} alt={`Seña de la letra ${letra}`} className="w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 object-contain drop-shadow-md mb-2" />
              <span className="font-comic text-2xl sm:text-3xl font-bold text-white drop-shadow-sm">
                {letra}
              </span>
            </motion.div>
          ))}
        </motion.div>
      </ResponsiveContainer>
    </PageLayout>
  );
}
