import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { i18nKeys } from "../../i18n/i18nKeys";
import intro1 from "../../assets/illustrations/intro-1-welcome.svg";
import intro2 from "../../assets/illustrations/intro-2-grundsicherung.svg";
import intro3 from "../../assets/illustrations/intro-3-questions.svg";
import intro4 from "../../assets/illustrations/intro-4-start.svg";

const SLIDE_COUNT = 4;

const ILLUSTRATIONS = [intro1, intro2, intro3, intro4] as const;

export const IntroCarousel: React.FC = () => {
	const { t, i18n } = useTranslation();
	const scrollRef = useRef<HTMLDivElement>(null);
	const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
	const [activeIndex, setActiveIndex] = useState(0);

	useEffect(() => {
		const root = scrollRef.current;
		if (!root) {
			return () => {};
		}

		const slides = slideRefs.current.slice(0, SLIDE_COUNT);
		const indexedSlides = slides
			.map((slide, index) => ({ slide, index }))
			.filter((item): item is { slide: HTMLDivElement; index: number } =>
				Boolean(item.slide),
			);
		if (indexedSlides.length !== SLIDE_COUNT) {
			return () => {};
		}

		const initialIndex = Math.min(
			SLIDE_COUNT - 1,
			Math.round(root.scrollLeft / Math.max(root.clientWidth, 1)),
		);
		setActiveIndex(initialIndex);

		const slideIndexByElement = new Map<Element, number>(
			indexedSlides.map(({ slide, index }) => [slide, index]),
		);

		const observer = new IntersectionObserver(
			(entries) => {
				let bestIndex: number | null = null;
				let bestRatio = 0;
				for (const entry of entries) {
					if (!entry.isIntersecting) {
						continue;
					}
					const index = slideIndexByElement.get(entry.target);
					if (index === undefined || entry.intersectionRatio <= bestRatio) {
						continue;
					}
					bestRatio = entry.intersectionRatio;
					bestIndex = index;
				}
				if (bestIndex !== null) {
					setActiveIndex(bestIndex);
				}
			},
			{
				root,
				threshold: [0.5, 0.75, 0.9],
			},
		);

		for (const { slide } of indexedSlides) {
			observer.observe(slide);
		}

		return () => {
			observer.disconnect();
		};
	}, [i18n.language]);

	const scrollToIndex = useCallback((idx: number) => {
		const el = slideRefs.current[idx];
		el?.scrollIntoView({
			behavior: "smooth",
			inline: "nearest",
			block: "nearest",
		});
	}, []);

	const advanceToNextSlide = useCallback(() => {
		const next = (activeIndex + 1) % SLIDE_COUNT;
		scrollToIndex(next);
	}, [activeIndex, scrollToIndex]);

	const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
		if (e.key === "ArrowRight") {
			e.preventDefault();
			scrollToIndex(Math.min(activeIndex + 1, SLIDE_COUNT - 1));
		} else if (e.key === "ArrowLeft") {
			e.preventDefault();
			scrollToIndex(Math.max(activeIndex - 1, 0));
		}
	};

	const sectionTitle = t(i18nKeys.start.introCards.sectionTitle);

	return (
		<section
			className="w-full mb-8 bg-primary-blue-100 rounded-xl p-6 shadow-sm"
			role="region"
			aria-roledescription="carousel"
			aria-labelledby="intro-carousel-heading"
		>
			<h2
				id="intro-carousel-heading"
				className="text-brand-black text-h1 font-bold leading-tight w-full mb-6"
			>
				{sectionTitle}
			</h2>

			<div
				ref={scrollRef}
				onKeyDown={onKeyDown}
				data-testid="intro-carousel-track"
				tabIndex={-1}
				className="flex w-full overflow-x-auto overflow-y-clip snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden rounded-md outline-none"
			>
				{Array.from({ length: SLIDE_COUNT }, (_, i) => {
					const step = i + 1;
					const title = t(i18nKeys.start.introCards.title(step));
					const description = t(i18nKeys.start.introCards.description(step));
					const slideAria = t(i18nKeys.start.introCards.slideAria, {
						current: step,
						total: SLIDE_COUNT,
					});

					return (
						<div
							key={step}
							ref={(el) => {
								slideRefs.current[i] = el;
							}}
							role="group"
							aria-roledescription="slide"
							aria-label={slideAria}
							data-testid={`intro-carousel-slide-${step}`}
							className="flex min-w-full shrink-0 snap-center justify-center px-1"
						>
							<button
								type="button"
								onClick={advanceToNextSlide}
								aria-label={t(i18nKeys.start.introCards.tapAdvance)}
								className="flex min-h-[450px] h-auto w-full max-w-[297px] cursor-pointer flex-col gap-6 rounded-xl bg-primary-blue-100 p-6 text-left transition-opacity hover:opacity-95 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-blue-500"
							>
								<div className="relative flex min-h-[170px] w-full shrink-0 items-center justify-center overflow-visible">
									<div
										className="absolute size-[150px] rounded-full bg-white "
										aria-hidden
									/>
									<img
										src={ILLUSTRATIONS[i]}
										alt=""
										className="relative z-10 max-h-[190px] aspect-square max-w-[190px] object-contain"
										draggable={false}
									/>
								</div>
								<div className="flex flex-col gap-3 text-left">
									<h3 className="text-brand-black text-h1 font-bold leading-tight">
										{title}
									</h3>
									<p className="text-brand-black text-body-lg font-normal leading-relaxed">
										{description}
									</p>
								</div>
							</button>
						</div>
					);
				})}
			</div>

			<div
				className="mt-6 flex w-full items-center justify-center gap-2.5"
				role="group"
				aria-label={sectionTitle}
			>
				{Array.from({ length: SLIDE_COUNT }, (_, i) => {
					const step = i + 1;
					const title = t(i18nKeys.start.introCards.title(step));
					const isActive = i === activeIndex;
					return (
						<button
							key={step}
							type="button"
							data-testid={`intro-carousel-dot-${step}`}
							className={`size-3.5 shrink-0 rounded-full transition-colors cursor-pointer border-none focus-visible:outline-2 focus-visible:outline-primary-blue-500 ${
								isActive
									? "bg-primary-blue-500"
									: "border border-primary-blue-500 bg-white"
							}`}
							aria-label={t(i18nKeys.start.introCards.dotAria, {
								index: step,
								title,
							})}
							aria-current={isActive ? "step" : undefined}
							onClick={() => scrollToIndex(i)}
						/>
					);
				})}
			</div>
		</section>
	);
};
