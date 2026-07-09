import React from "react";

/** Matches the SVG viewBox height — used for layout alignment with the FAB */
export const MOBILE_BAR_PX = 77;

/** Mobile bar background — viewBox 0 0 393 77 */
const NAV_BAR_PATH =
	"M393 63C393 70.732 386.732 77 379 77H14C6.26802 77 0 70.732 0 63V14C0 6.26806 6.24007 7.17407e-05 13.972 5.23105e-05C56.1853 -5.37702e-05 117.622 2.69323e-05 144.926 7.22895e-05C152.658 8.51337e-05 158.636 6.41659 160.897 13.8107C166.049 30.6633 180.563 41.033 197.001 41.033C217.85 41.033 228.055 27.1811 232.025 13.7964C234.224 6.38373 240.364 9.76957e-05 248.096 9.76957e-05H379C386.732 9.76957e-05 393 6.26811 393 14.0001V63Z";

export const NavBarShape: React.FC = () => (
	<svg
		className="pointer-events-none absolute inset-x-0 bottom-0 h-[77px] w-full text-primary-blue-500"
		viewBox="0 0 393 77"
		width="100%"
		height={MOBILE_BAR_PX}
		preserveAspectRatio="none"
		aria-hidden
	>
		<path
			fill="currentColor"
			fillRule="evenodd"
			clipRule="evenodd"
			d={NAV_BAR_PATH}
		/>
	</svg>
);
