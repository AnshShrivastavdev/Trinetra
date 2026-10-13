import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Bot, X, Send, ShieldCheck, User } from "lucide-react";

export const AIChatbotWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputMsg, setInputMsg] = useState("");
  const [messages, setMessages] = useState<Array<{ sender: "bot" | "user"; text: string }>>([
    {
      sender: "bot",
      text: "Hello! I am Trinetra's AI Safety Assistant. How can I help you with emergency reporting, safety tips, or platform guidance?"
    }
  ]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim()) return;

    const userText = inputMsg.trim();
    setMessages(prev => [...prev, { sender: "user", text: userText }]);
    setInputMsg("");

    // Simulated intelligent AI responses
    setTimeout(() => {
      let botResponse = "Trinetra uses real-time spatial geocoding and AI duplicate analysis to ensure fast civic response. You can report incidents anonymously from the main portal.";
      const lower = userText.toLowerCase();
      if (lower.includes("report") || lower.includes("crime") || lower.includes("incident")) {
        botResponse = "To report a crime or incident, click 'Access Core Portal' to sign in as a Citizen. You can attach photos/videos and mask your identity for 100% anonymity.";
      } else if (lower.includes("emergency") || lower.includes("urgent") || lower.includes("sos")) {
        botResponse = "🚨 Emergency Alert: For immediate life-threatening situations, please contact local emergency authorities (112 / 911 / 100) immediately in addition to filing a report on Trinetra.";
      } else if (lower.includes("ai") || lower.includes("duplicate")) {
        botResponse = "Our system integrates AI algorithms to analyze report descriptions against historical incidents within a 5km radius to filter duplicates and verify credibility.";
      } else if (lower.includes("vote") || lower.includes("upvote")) {
        botResponse = "Upvoting allows the community to validate reports. High-priority incidents with multiple upvotes are automatically highlighted on authority dispatch dashboards.";
      }

      setMessages(prev => [...prev, { sender: "bot", text: botResponse }]);
    }, 600);
  };

  return (
    <div className="fixed bottom-24 right-20 z-50 font-body">
      {/* Chat Window Popup */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="liquid-glass w-[340px] sm:w-[380px] h-[460px] rounded-3xl border border-amber-500/30 flex flex-col shadow-[0_0_30px_rgba(245,158,11,0.25)] overflow-hidden mb-4"
          >
            {/* Header */}
            <div className="p-4 border-b border-white/10 bg-black/80 backdrop-blur-md flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center relative">
                  <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-black animate-ping" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
                    Security Chatbot
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                  </h3>
                  <span className="text-[10px] text-zinc-400">Live Safety Assistant</span>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Chat Messages Body */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-black/40 text-xs">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex gap-2 max-w-[85%] ${
                    msg.sender === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] ${
                      msg.sender === "user"
                        ? "bg-white text-black"
                        : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    }`}
                  >
                    {msg.sender === "user" ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                  </div>
                  <div
                    className={`p-3 rounded-2xl leading-relaxed ${
                      msg.sender === "user"
                        ? "bg-white text-black rounded-tr-none font-medium"
                        : "liquid-glass border border-white/10 text-zinc-200 rounded-tl-none"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSend} className="p-3 border-t border-white/10 bg-black/80 flex gap-2">
              <input
                type="text"
                value={inputMsg}
                onChange={(e) => setInputMsg(e.target.value)}
                placeholder="Ask safety chatbot..."
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50"
              />
              <button
                type="submit"
                className="w-10 h-10 rounded-xl bg-amber-500 text-black font-bold flex items-center justify-center hover:bg-amber-400 transition-colors shadow-[0_0_15px_rgba(245,158,11,0.3)]"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Action Trigger Button - Enlarged Square Badge positioned directly over background star logo */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group relative flex flex-col items-center justify-center w-24 h-24 rounded-3xl bg-black/95 backdrop-blur-2xl border border-amber-500/50 shadow-[0_0_30px_rgba(245,158,11,0.45)] hover:border-amber-400 hover:shadow-[0_0_40px_rgba(245,158,11,0.65)] hover:scale-105 transition-all duration-300 cursor-pointer overflow-hidden"
      >
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-black shadow-lg mb-1.5">
          <Sparkles className="w-5 h-5 text-black" />
        </div>
        <span className="text-xs font-bold text-white tracking-widest uppercase">Chatbot</span>
        <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse border border-black" />
      </button>
    </div>
  );
};
