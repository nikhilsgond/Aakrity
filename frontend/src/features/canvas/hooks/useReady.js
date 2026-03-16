import { useRef, useEffect, useState, useCallback } from 'react';

export function  useReady(containerRef) {
    const [isContainerReady, setIsContainerReady] = useState(false);
    const mountedRef = useRef(false);

    // Track mount state
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    // Track container readiness
    useEffect(() => {
        let frameId = null;

        const resolveContainer = () => {
            if (!mountedRef.current) return;

            if (containerRef?.current) {
                setIsContainerReady(true);
                return;
            }

            frameId = window.requestAnimationFrame(resolveContainer);
        };

        resolveContainer();

        return () => {
            if (frameId) {
                window.cancelAnimationFrame(frameId);
            }
        };
    }, [containerRef]); 

    // Combined ready state
    const ready = isContainerReady && mountedRef.current;

    // Safe execution wrapper
    const whenReady = useCallback((fn) => {
        return (...args) => {
            if (!ready) {
                console.debug('⏳ System not ready yet');
                return null;
            }
            return fn(...args);
        };
    }, [ready]);

    return {
        ready,
        whenReady,
        isContainerReady,
    };
}