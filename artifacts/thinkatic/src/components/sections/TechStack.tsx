export function TechStack() {
  const techs = [
    "OpenAI", "Anthropic", "LangChain", "PyTorch", "TensorFlow", 
    "Hugging Face", "FastAPI", "PostgreSQL", "AWS", "GCP", 
    "Docker", "Kubernetes", "React", "Node.js", "Python"
  ];

  return (
    <section className="py-24 overflow-hidden border-t border-border bg-background">
      <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 px-6">
        {techs.map((tech) => (
          <span key={tech} className="text-2xl md:text-4xl font-display font-bold text-foreground/10 uppercase tracking-wider">
            {tech}
          </span>
        ))}
      </div>
    </section>
  );
}
