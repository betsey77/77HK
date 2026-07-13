import { Heart, HelpCircle, Lightbulb, Smile, MessageCircle } from 'lucide-react';
import type { SimulatedComment, CommentType } from '../../types';

interface SimulatedCommentsProps {
  comments: SimulatedComment[];
}

const commentIcons: Record<CommentType, typeof Heart> = {
  interest: Heart,
  question: HelpCircle,
  skepticism: Lightbulb,
  playful: Smile,
  followup: MessageCircle,
};

const commentColors: Record<CommentType, string> = {
  interest: 'text-pink-400',
  question: 'text-blue-400',
  skepticism: 'text-amber-400',
  playful: 'text-purple-400',
  followup: 'text-emerald-400',
};

export default function SimulatedComments({ comments }: SimulatedCommentsProps) {
  if (comments.length === 0) {
    return <p className="text-xs text-gray-600 light:text-gray-500">没有模拟留言</p>;
  }

  return (
    <div className="space-y-2">
      {comments.map((c, i) => {
        const Icon = commentIcons[c.type];
        return (
          <div
            key={i}
            className="bg-gray-800/20 light:bg-gray-100 border border-gray-700/30 light:border-gray-300/50 rounded-lg px-2.5 py-2"
          >
            <div className="flex items-center gap-1.5 mb-0.5">
              <Icon size={12} className={commentColors[c.type]} />
              <span className="text-[10px] text-gray-600 light:text-gray-500">
                {c.type === 'interest' && '有兴趣'}
                {c.type === 'question' && '想了解'}
                {c.type === 'skepticism' && '有保留'}
                {c.type === 'playful' && '玩味留言'}
                {c.type === 'followup' && '跟进问题'}
              </span>
            </div>
            <p className="text-xs text-gray-300 light:text-gray-800">{c.text}</p>
          </div>
        );
      })}
    </div>
  );
}
