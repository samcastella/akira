// src/app/programas/detox-tecnologico/page.tsx
import ProgramDetail from "@/components/ProgramDetail";

export default function Page() {
  return (
    <ProgramDetail
      slug="detox-tecnologico-30"
      imageSrc="/images/programs/detox-hero.jpg"
      title="Détox Tecnológico: recupera tu atención"
      shortDescription="¿Te gustaría recuperar tu atención? Haz un détox amable y usa el móvil a tu favor para reconectar con tu entorno."
      howItWorks={`¿Te cuesta concentrarte y mantener la atención?
¿Miras el móvil sin saber por qué?
¿Sientes que te desconectas de la gente que tienes delante?
No es falta de voluntad: es cómo está diseñado tu entorno (notificaciones, scroll, luces). Aquí vas a reentrenar tu atención y usar la tecnología a tu favor.`}
    />
  );
}
