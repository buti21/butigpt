import { useMemo } from "react";
import { ButiLogo } from "./ButiLogo";
import {
  Lightbulb, Code2, BookOpen, ListChecks, Sparkles, Rocket,
  Brain, PenLine, Coffee, Music, Globe, Calculator, Heart,
  Briefcase, GraduationCap, ChefHat, Plane, Camera, Image as ImageIcon,
  FileText, Languages, MessageCircle, Wand2,
} from "lucide-react";

interface Props {
  onPick: (prompt: string) => void;
}

const POOL = [
  { icon: Lightbulb, label: "Dă-mi o idee de proiect personal", prompt: "Dă-mi o idee originală de proiect personal pe care l-aș putea construi într-un weekend." },
  { icon: Code2, label: "Explică-mi recursivitatea", prompt: "Explică-mi simplu ce este recursivitatea, cu un exemplu în JavaScript." },
  { icon: BookOpen, label: "Ajută-mă să-mi organizez ziua", prompt: "Ajută-mă să-mi organizez ziua de mâine în blocuri de timp productive." },
  { icon: ListChecks, label: "Rezumă-mi un text lung", prompt: "Pot să-ți dau un text lung și să mi-l rezumi în 5 puncte cheie?" },
  { icon: Sparkles, label: "Surprinde-mă cu ceva interesant", prompt: "Spune-mi un fapt fascinant pe care probabil nu îl știam." },
  { icon: Rocket, label: "Pornește o idee de business", prompt: "Ajută-mă să validez o idee de business pas cu pas." },
  { icon: Brain, label: "Învață-mă ceva nou în 5 minute", prompt: "Învață-mă ceva util și nou pe care îl pot înțelege în 5 minute." },
  { icon: PenLine, label: "Scrie un email profesional", prompt: "Ajută-mă să scriu un email profesional pentru o cerere de colaborare." },
  { icon: Coffee, label: "Recomandă-mi o rutină de dimineață", prompt: "Propune-mi o rutină de dimineață realistă care să-mi crească energia." },
  { icon: Music, label: "Sugestii muzicale după mood", prompt: "Recomandă-mi 5 melodii pentru o seară relaxantă acasă." },
  { icon: Globe, label: "Planifică-mi o călătorie", prompt: "Ajută-mă să-mi planific o călătorie de 3 zile într-un oraș european." },
  { icon: Calculator, label: "Ajută-mă cu matematica", prompt: "Explică-mi pas cu pas cum rezolv o ecuație de gradul doi." },
  { icon: Heart, label: "Dă-mi un sfat de wellness", prompt: "Dă-mi un sfat simplu de wellness pe care îl pot aplica azi." },
  { icon: Briefcase, label: "Pregătește-mă pentru interviu", prompt: "Pregătește-mă pentru un interviu tehnic — pune-mi 3 întrebări frecvente." },
  { icon: GraduationCap, label: "Explică-mi un concept dificil", prompt: "Explică-mi cum funcționează blockchain-ul, ca pentru un copil de 10 ani." },
  { icon: ChefHat, label: "Recomandă-mi o rețetă rapidă", prompt: "Dă-mi o rețetă rapidă pentru cină, cu maxim 5 ingrediente." },
  { icon: Plane, label: "Idei de city break", prompt: "Sugerează-mi 3 destinații de city break pentru un weekend prelungit." },
  { icon: Camera, label: "Sfaturi de fotografie", prompt: "Dă-mi 5 sfaturi pentru fotografii mai bune cu telefonul." },
  { icon: ImageIcon, label: "Generează-mi o imagine", prompt: "Generează o imagine cu un oraș futurist la apus, în stil cinematic." },
  { icon: FileText, label: "Fă-mi o prezentare PowerPoint", prompt: "Fă-mi o prezentare PowerPoint despre inteligența artificială, 8 slide-uri." },
  { icon: Languages, label: "Tradu-mi un text", prompt: "Pot să-ți dau un text și să mi-l traduci în engleză natural?" },
  { icon: MessageCircle, label: "Ajută-mă să formulez un mesaj", prompt: "Ajută-mă să formulez politicos un mesaj prin care refuz o invitație." },
  { icon: Wand2, label: "Idei creative pentru conținut", prompt: "Dă-mi 5 idei creative de postări pentru Instagram pentru săptămâna asta." },
];

const sampleN = <T,>(arr: T[], n: number): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
};

export const Welcome = ({ onPick }: Props) => {
  const suggestions = useMemo(() => sampleN(POOL, 4), []);
  return (
    <div className="flex h-full w-full items-center justify-center px-4 animate-fade-in">
      <div className="mx-auto w-full max-w-2xl text-center">
        <ButiLogo className="mx-auto h-16 w-16" />
        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-foreground">
          Bine ai venit la ButiGPT
        </h1>
        <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground">
          Sunt asistentul tău AI personal. Întreabă-mă orice — te ajut cu idei,
          explicații, cod sau organizare.
        </p>

        <div className="mt-10 grid gap-3 sm:grid-cols-2">
          {suggestions.map(({ icon: Icon, label, prompt }, i) => (
            <button
              key={label}
              onClick={() => onPick(prompt)}
              style={{ animationDelay: `${i * 60}ms` }}
              className="group flex items-center gap-3 rounded-xl border border-border bg-surface-1/60 px-4 py-3 text-left text-sm text-foreground transition-all duration-300 ease-out hover:border-primary/50 hover:bg-surface-2 hover:shadow-soft hover:-translate-y-0.5 animate-fade-in"
            >
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-secondary text-primary-glow transition-colors group-hover:bg-primary/15">
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
