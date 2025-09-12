import ProgramDetail from "@/components/ProgramDetail";

export default function Page() {
  return (
    <ProgramDetail
      slug="lectura-30"
      imageSrc="/images/programs/lectura-hero.jpg"
      title="Programa de Lectura: de 0 a 100 en 30 días"
      shortDescription="Aprende a disfrutar de la lectura paso a paso. Empiezas con 1 página al día y terminas leyendo 20–25 minutos con constancia y motivación."
      howItWorks="Este programa combina ciencia de hábitos, comportamiento humano y neurociencia para ayudarte a convertirte en lector. Empiezas con acciones muy pequeñas para reducir la fricción y, día a día, refuerzas señales (hora, lugar, ritual), compromiso social y recompensas. El objetivo no es solo leer más, sino consolidar tu identidad de lector y mantenerla en el tiempo."
      startHref="/habitos/lectura/dia-1"
    />
  );
}
