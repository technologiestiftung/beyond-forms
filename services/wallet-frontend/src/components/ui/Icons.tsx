import React from "react";
import {
	User,
	Globe,
	Layers,
	Users,
	Mail,
	Smartphone,
	Menu,
	X,
	LogOut,
	Wallet,
	MessageSquare,
	Settings,
	HelpCircle,
	Hand,
	Send,
	History,
	Paperclip,
	PiggyBank,
	House,
	ListCheck,
	Cross,
	Euro,
	Plus,
	Loader2,
} from "lucide-react";

interface IconProps {
	className?: string;
}

/**
 * Step 1: Welcome / Wave
 */
export const StepIcon1: React.FC<IconProps> = ({ className }) => (
	<Hand className={className} strokeWidth={2} />
);

export const UserIcon: React.FC<IconProps> = ({ className }) => (
	<User className={className} strokeWidth={2.5} />
);

export const MailIcon: React.FC<IconProps> = ({ className }) => (
	<Mail className={className} strokeWidth={2.5} />
);

interface CheckCircleIconProps {
	className?: string;
	checkStroke?: string;
}

export const CheckCircleIcon: React.FC<CheckCircleIconProps> = ({
	className,
	checkStroke = "white",
}) => (
	<svg
		className={className}
		viewBox="0 0 24 24"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
		aria-hidden="true"
	>
		<circle cx="12" cy="12" r="12" fill="currentColor" />
		<path
			d="M7 12.5L10.5 16L17 8"
			stroke={checkStroke}
			strokeWidth="3"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</svg>
);

export const PhoneIcon: React.FC<IconProps> = ({ className }) => (
	<Smartphone className={className} strokeWidth={2.5} />
);

export const GlobeIcon: React.FC<IconProps> = ({ className }) => (
	<Globe className={className} strokeWidth={2} />
);

export const LayersIcon: React.FC<IconProps> = ({ className }) => (
	<Layers className={className} strokeWidth={2} />
);

export const UsersIcon: React.FC<IconProps> = ({ className }) => (
	<Users className={className} strokeWidth={2} />
);

export const MenuIcon: React.FC<IconProps> = ({ className }) => (
	<Menu className={className} strokeWidth={2.5} />
);

export const XIcon: React.FC<IconProps> = ({ className }) => (
	<X className={className} strokeWidth={2.5} />
);

export const LogoutIcon: React.FC<IconProps> = ({ className }) => (
	<LogOut className={className} strokeWidth={2.5} />
);

export const WalletIcon: React.FC<IconProps> = ({ className }) => (
	<Wallet className={className} strokeWidth={2.5} />
);

export const ChatIcon: React.FC<IconProps> = ({ className }) => (
	<MessageSquare className={className} strokeWidth={2} />
);

export const HistoryIcon: React.FC<IconProps> = ({ className }) => (
	<History className={className} strokeWidth={2} />
);

export const SettingsIcon: React.FC<IconProps> = ({ className }) => (
	<Settings className={className} strokeWidth={2} />
);

export const HelpIcon: React.FC<IconProps> = ({ className }) => (
	<HelpCircle className={className} strokeWidth={2} />
);

export const SendIcon: React.FC<IconProps> = ({ className }) => (
	<Send className={className} strokeWidth={2.5} aria-hidden="true" />
);

export const PaperclipIcon: React.FC<IconProps> = ({ className }) => (
	<Paperclip className={className} strokeWidth={2.5} aria-hidden="true" />
);

export const LoaderIcon: React.FC<IconProps> = ({ className }) => (
	<Loader2 className={className} strokeWidth={2.5} aria-hidden="true" />
);

export const PiggyBankIcon: React.FC<IconProps> = ({ className }) => (
	<PiggyBank className={className} strokeWidth={2} />
);

export const HouseIcon: React.FC<IconProps> = ({ className }) => (
	<House className={className} strokeWidth={2} />
);

export const ListCheckIcon: React.FC<IconProps> = ({ className }) => (
	<ListCheck className={className} strokeWidth={2} />
);

export const CrossIcon: React.FC<IconProps> = ({ className }) => (
	<Cross className={className} strokeWidth={2} />
);

export const EuroIcon: React.FC<IconProps> = ({ className }) => (
	<Euro className={className} strokeWidth={2} />
);

export const PlusIcon: React.FC<IconProps> = ({ className }) => (
	<Plus className={className} strokeWidth={2.5} />
);
