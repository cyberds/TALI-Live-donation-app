"use client";

import type {
  GlobalOptions as ConfettiGlobalOptions,
  CreateTypes as ConfettiInstance,
  Options as ConfettiOptions,
} from "canvas-confetti";
import confetti from "canvas-confetti";
import React, {
  createContext,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";

type Api = {
  fire: (options?: ConfettiOptions) => void;
};

type Props = React.ComponentPropsWithRef<"canvas"> & {
  options?: ConfettiGlobalOptions;
  onReady?: (api: Api) => void;
  manualstart?: boolean;
};

const ConfettiContext = createContext<Api>({
  fire: () => {},
});

const Confetti = forwardRef<Api, Props>((props, ref) => {
  const {
    options: globalOptions,
    onReady,
    manualstart = false,
    ...rest
  } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const instanceRef = useRef<ConfettiInstance | null>(null);

  const canvasStyles = useMemo(
    () => ({
      ...props.style,
      position: "fixed",
      width: "100%",
      height: "100%",
      top: 0,
      left: 0,
      zIndex: 99999,
      pointerEvents: "none",
    } as React.CSSProperties),
    [props.style]
  );

  const api = useMemo(
    () => ({
      fire: (options?: ConfettiOptions) => {
        if (instanceRef.current) {
          instanceRef.current({
            ...options,
            origin: options?.origin || { y: 0.5 },
          });
        }
      },
    }),
    []
  );

  useImperativeHandle(ref, () => api, [api]);

  useEffect(() => {
    if (canvasRef.current && !instanceRef.current) {
      instanceRef.current = confetti.create(canvasRef.current, {
        ...globalOptions,
        resize: true,
      });
    }

    return () => {
      if (instanceRef.current) {
        instanceRef.current.reset();
        instanceRef.current = null;
      }
    };
  }, [globalOptions]);

  useEffect(() => {
    if (!manualstart) {
      api.fire();
    }
  }, [manualstart, api]);

  useEffect(() => {
    onReady?.(api);
  }, [onReady, api]);

  return (
    <ConfettiContext.Provider value={api}>
      <canvas ref={canvasRef} {...rest} style={canvasStyles} />
    </ConfettiContext.Provider>
  );
});

Confetti.displayName = "Confetti";

export interface ConfettiButtonProps extends Props {
  children?: React.ReactNode;
}

export { Confetti };

export default Confetti;
