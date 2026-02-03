"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      richColors
      position="top-center"
      toastOptions={{
        style: {
          padding: '18px 24px',
          fontSize: '16px',
          fontWeight: '600',
          borderRadius: '16px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
          border: '2px solid rgba(0,0,0,0.05)',
        },
      }}
      icons={{
        success: <CircleCheckIcon className="size-6 text-green-600" />,
        info: <InfoIcon className="size-6 text-blue-600" />,
        warning: <TriangleAlertIcon className="size-6 text-amber-600" />,
        error: <OctagonXIcon className="size-6 text-red-600" />,
        loading: <Loader2Icon className="size-6 animate-spin text-primary" />,
      }}
      {...props}
    />
  )
}

export { Toaster }
