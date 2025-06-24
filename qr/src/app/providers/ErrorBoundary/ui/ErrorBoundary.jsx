import React, { Component } from 'react';
import {NotFoundPage} from "@/pages/NotFoundPage/index.js";


class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Captured error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return <NotFoundPage />;
        }

        return this.props.children;
    }
}

export default ErrorBoundary;