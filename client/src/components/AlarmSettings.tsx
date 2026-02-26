import { useState, useEffect } from "react";
import { Bell, BellOff, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Language, t } from "@/lib/translations";

interface AlarmSettingsProps {
  language: Language;
}

export default function AlarmSettings({ language }: AlarmSettingsProps) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const { toast } = useToast();

  useEffect(() => {
    if ("Notification" in window) {
      setPermission(Notification.permission);
    }
    
    const savedState = localStorage.getItem("trashAlarmEnabled");
    if (savedState === "true") {
      setIsEnabled(true);
    }
  }, []);

  useEffect(() => {
    if (!isEnabled) return;

    const checkAndNotify = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      
      if (hours === 22 && minutes === 20) {
        if (permission === "granted") {
          new Notification(t("trashReminder", language), {
            body: t("trashReminderBody", language),
            icon: "/favicon.png",
            tag: "trash-reminder"
          });
        }
      }
    };

    const interval = setInterval(checkAndNotify, 60000);
    return () => clearInterval(interval);
  }, [isEnabled, permission, language]);

  const handleToggle = async () => {
    if (!isEnabled) {
      let currentPermission = permission;
      
      if (currentPermission === "default") {
        const result = await Notification.requestPermission();
        setPermission(result);
        currentPermission = result;
      }
      
      if (currentPermission !== "granted") {
        toast({
          title: t("permissionNeeded", language),
          description: t("enableNotifications", language),
          variant: "destructive"
        });
        return;
      }

      setIsEnabled(true);
      localStorage.setItem("trashAlarmEnabled", "true");
      
      toast({
        title: t("alarmEnabled", language),
        description: t("reminderTime", language)
      });
    } else {
      setIsEnabled(false);
      localStorage.setItem("trashAlarmEnabled", "false");
      
      toast({
        title: t("alarmDisabled", language)
      });
    }
  };

  return (
    <Card className="glass-card border-0 shadow-lg hover:shadow-xl transition-smooth rounded-2xl overflow-hidden">
      <div className="p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            <div className={`h-12 w-12 rounded-full flex items-center justify-center transition-smooth ${
              isEnabled 
                ? 'bg-primary shadow-lg' 
                : 'bg-muted/50'
            }`}>
              {isEnabled ? (
                <Bell className="h-6 w-6 text-white" />
              ) : (
                <BellOff className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">
                {t("dailyReminder", language)}
              </h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                <Clock className="h-3.5 w-3.5" />
                <span>10:20 PM</span>
              </div>
            </div>
          </div>
          <Switch
            checked={isEnabled}
            onCheckedChange={handleToggle}
            className="data-[state=checked]:bg-primary"
            data-testid="switch-alarm"
          />
        </div>
      </div>
    </Card>
  );
}
