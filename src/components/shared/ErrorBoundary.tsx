import React, { Component, ErrorInfo, ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[40vh] items-center justify-center p-4">
          <Card className="w-full max-w-md border-destructive/50">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-2">
                <AlertTriangle className="h-10 w-10 text-destructive" />
              </div>
              <CardTitle>Algo deu errado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                Ocorreu um erro inesperado nesta parte do sistema.
              </p>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => window.location.reload()}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Recarregar página
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
