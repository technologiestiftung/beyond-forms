import React from "react";
import { motion } from "framer-motion";
import * as Icons from "../ui/Icons";
import { MOBILE_BAR_PX } from "./NavBarShape";

interface ChatButtonProps {
	onClick: () => void;
	active: boolean;
	label: string;
}

export const ChatButton: React.FC<ChatButtonProps> = ({
	onClick,
	active,
	label,
}) => (
	<motion.button
		type="button"
		whileTap={{ scale: 0.92 }}
		onClick={onClick}
		data-testid="nav-chat-button"
		aria-label={label}
		className={`
      absolute left-1/2 z-20 flex size-[60px] -translate-x-1/2 items-center justify-center
      rounded-full bg-primary-green-500 text-primary-blue-500 shadow-[0_0_5px_rgba(0,8,82,0.3)]
      outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2
      focus-visible:ring-offset-primary-blue-500
      ${active ? "ring-2 ring-white/80" : ""}
    `}
		style={{ bottom: MOBILE_BAR_PX - 30 }}
	>
		<Icons.ChatIcon className="size-7" />
	</motion.button>
);
