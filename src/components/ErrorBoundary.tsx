import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
        this.setState({ error, errorInfo });
    }

    private handleReload = () => {
        window.location.reload();
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background text-foreground text-center">
                    <div className="bg-destructive/10 p-4 rounded-full mb-4">
                        <AlertTriangle className="w-12 h-12 text-destructive" />
                    </div>
                    <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
                    <p className="text-muted-foreground mb-6 max-w-md">
                        We apologize for the inconvenience. An unexpected error occurred.
                    </p>

                    {/* Show error details in development */}
                    {process.env.NODE_ENV === 'development' && this.state.error && (
                        <div className="w-full max-w-lg mb-6 p-4 bg-muted rounded-lg overflow-auto text-left">
                            <p className="font-mono text-xs text-destructive mb-2">
                                {this.state.error.toString()}
                            </p>
                            <pre className="font-mono text-[10px] text-muted-foreground">
                                {this.state.errorInfo?.componentStack}
                            </pre>
                        </div>
                    )}

                    <Button onClick={this.handleReload} className="gap-2">
                        <RefreshCw className="w-4 h-4" />
                        Reload Application
                    </Button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
