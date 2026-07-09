import { Component, type ErrorInfo, type ReactNode } from "react";
import { ErrorFallback } from "./ErrorFallback";

interface Props {
	children: ReactNode;
	fallback?: ReactNode;
	resetStrategy?: "full" | "reload";
}

interface State {
	hasError: boolean;
	error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
	public state: State = {
		hasError: false,
	};

	public static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error };
	}

	public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		console.error("Uncaught error:", error, errorInfo);
	}

	public override render() {
		if (this.state.hasError) {
			return (
				this.props.fallback || (
					<ErrorFallback resetStrategy={this.props.resetStrategy} />
				)
			);
		}

		return this.props.children;
	}
}
