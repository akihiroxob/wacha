import { FC } from "hono/jsx";
import clsx from "clsx";

const badgeVariants = {
  gray: "bg-gray-100 text-gray-700 border-gray-300",
  blue: "bg-blue-100 text-blue-700 border-blue-300",
  purple: "bg-purple-100 text-purple-700 border-purple-300",
  amber: "bg-amber-100 text-amber-700 border-amber-300",
  green: "bg-green-100 text-green-700 border-green-300",
  red: "bg-red-100 text-red-700 border-red-300",
} as const;

type BadgeVariant = keyof typeof badgeVariants;

export const Badge: FC<{
  text: string;
  variant?: BadgeVariant;
}> = ({ text, variant = "gray" }) => {
  return (
    <span
      class={clsx(
        "inline-flex items-center justify-center rounded-md border px-2 py-0.5 font-medium w-fit whitespace-nowrap shrink-0 text-xs",
        badgeVariants[variant],
      )}
    >
      {text}
    </span>
  );
};

export const TodoBadge = () => Badge({ text: "Todo", variant: "gray" });
export const DoingBadge = () => Badge({ text: "Doing", variant: "blue" });
export const DoneBadge = () => Badge({ text: "Done", variant: "green" });
export const CanceledBadge = () => Badge({ text: "Canceled", variant: "red" });
export const InReviewBadge = () => Badge({ text: "InReview", variant: "purple" });
export const WaitAcceptBadge = () => Badge({ text: "WaitAccept", variant: "amber" });
export const AcceptedBadge = () => Badge({ text: "Accepted", variant: "green" });
export const RejectedBadge = () => Badge({ text: "Rejected", variant: "red" });
