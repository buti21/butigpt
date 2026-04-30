import { ButiLogo } from "./ButiLogo";
import { Lightbulb, Code2, BookOpen, ListChecks } from "lucide-react";

interface Props {
  onPick: (prompt: string) => void;
}

const SUGGESTIONS = [
  { icon: Lightbulb, label: "Dă-mi o idee de proiect personal", prompt: "Dă-mi o idee originală de proiect personal pe care l-aș putea construi într-un weekend." },
  { icon: Code2, label: "Explică-mi ce e recursivitatea", prompt: "Explică-mi simplu ce este recursivitatea, cu un exemplu în JavaScript." },
  { icon: BookOpen, label: "Ajută-mă să-mi organizez ziua", prompt: "Ajută-mă să-mi organizez ziua de mâine în blocuri de timp productive." },
  { icon: ListChecks, label: "Rezumă-mi un text lung", prompt: "Pot să-ți dau un text lung și să mi-l rezumi în 5 puncte cheie?" },
];

export const Welcome = ({ onPick }: Props) => {
  return (
    <div className="flex h-full w-full items-center justify-center px-4">
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
          {SUGGESTIONS.map(({ icon: Icon, label, prompt }) => (
            <button
              key={label}
              onClick={() => onPick(prompt)}
              className="group flex items-center gap-3 rounded-xl border border-border bg-surface-1/60 px-4 py-3 text-left text-sm text-foreground transition-all duration-200 hover:border-primary/50 hover:bg-surface-2 hover:shadow-soft"
            >
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-secondary text-primary-glow group-hover:bg-primary/15">
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
