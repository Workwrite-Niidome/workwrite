'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FAQItem {
  q: string;
  a: string;
}

const FAQ_SECTIONS: { title: string; items: FAQItem[] }[] = [
  {
    title: 'Getting Started',
    items: [
      {
        q: 'How do I create an account?',
        a: 'Click "Start Writing" or "Register" from the top page. Enter your nickname, email address, and password to create an account. After registration, you can optionally complete an onboarding quiz to receive personalized recommendations.',
      },
      {
        q: 'What is the onboarding quiz?',
        a: 'A short 5-question quiz about your reading preferences. Based on your answers, we generate a personalized emotion vector to recommend works that match your taste. You can skip it and complete it later.',
      },
      {
        q: 'How do I find works to read?',
        a: 'Use the search page to search by title or keyword. You can also browse by emotion tags from the home page, or explore "Hidden Gems" for underappreciated works with high AI scores.',
      },
    ],
  },
  {
    title: 'Reading',
    items: [
      {
        q: 'How does the bookshelf work?',
        a: 'Add works to your bookshelf with three statuses: "Want to Read", "Reading", and "Completed". Your reading progress is automatically saved as you read episodes.',
      },
      {
        q: 'Can I customize the reading experience?',
        a: 'Yes. While reading, you can change the font size (small, medium, large, extra-large) and theme (light, dark, sepia). These preferences are saved automatically.',
      },
      {
        q: 'What is the afterword flow?',
        a: 'After completing a work, you\'ll enter a reflection flow where you can tag your emotions, record how the work changed you, and write a review. This data builds your personal reading timeline.',
      },
    ],
  },
  {
    title: 'Writing',
    items: [
      {
        q: 'How do I publish a work?',
        a: 'Go to the writing dashboard and click "New Work". Add a title, synopsis, and genre, then create episodes. When ready, change the work status to "Published".',
      },
      {
        q: 'What is AI scoring?',
        a: 'Our AI analyzes your work across four dimensions: Immersion, Transformation, Virality, and World Building. Each dimension is scored 0-100, with improvement tips provided. You can trigger re-scoring from the work analytics page.',
      },
      {
        q: 'Can I unpublish a work?',
        a: 'Yes. From the work edit page, you can change the status to "Unpublished" at any time. Unpublished works are hidden from search and discovery but retain all their data.',
      },
    ],
  },
  {
    title: 'Account & Settings',
    items: [
      {
        q: 'How do I change my profile?',
        a: 'Go to your profile page (accessible from the header or bottom navigation). You can update your nickname, display name, and bio.',
      },
      {
        q: 'How do I change my password?',
        a: 'Go to Settings from your profile page. Under "Security", you can change your password by entering your current password and a new one.',
      },
      {
        q: 'How do I delete my account?',
        a: 'Go to Settings and scroll to the "Danger Zone" section. Account deletion is permanent and will remove all your works, reviews, and reading data.',
      },
    ],
  },
  {
    title: 'Points & Timeline',
    items: [
      {
        q: 'How do I earn points?',
        a: 'You earn points by writing reviews, adding emotion tags, and recording state changes after reading. Points are displayed on your timeline page.',
      },
      {
        q: 'What is the timeline?',
        a: 'Your timeline tracks how reading has changed you over time. It shows emotion tags, state changes (e.g., confidence or worldview shifts), and reviews you\'ve written. It\'s a personal record of growth through reading.',
      },
    ],
  },
];

function Accordion({ item }: { item: FAQItem }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-border">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-4 text-left text-sm hover:text-foreground transition-colors"
        aria-expanded={open}
      >
        <span className={cn(open ? 'text-foreground font-medium' : 'text-muted-foreground')}>
          {item.q}
        </span>
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform flex-shrink-0 ml-4', open && 'rotate-180')} />
      </button>
      <div className={cn('overflow-hidden transition-all', open ? 'max-h-40 pb-4' : 'max-h-0')}>
        <p className="text-sm text-muted-foreground leading-relaxed">{item.a}</p>
      </div>
    </div>
  );
}

export default function HelpPage() {
  return (
    <div className="px-6 py-8">
      <h1 className="text-lg font-semibold tracking-wide mb-2">Help</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Frequently asked questions about Workwrite.
      </p>

      <div className="space-y-10">
        {FAQ_SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="text-xs tracking-[0.15em] uppercase text-muted-foreground mb-3">{section.title}</h2>
            <div>
              {section.items.map((item) => (
                <Accordion key={item.q} item={item} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-12 pt-8 border-t border-border text-center">
        <p className="text-sm text-muted-foreground mb-2">Still have questions?</p>
        <p className="text-sm text-muted-foreground">
          Check our <Link href="/guidelines" className="underline hover:text-foreground transition-colors">publishing guidelines</Link> or
          contact us at <span className="text-foreground">support@workwrite.app</span>
        </p>
      </div>
    </div>
  );
}
