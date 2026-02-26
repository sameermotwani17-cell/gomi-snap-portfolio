import { useState, useEffect } from "react";
import { MessageSquare, AlertCircle, ImageOff, Languages, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertFeedbackSchema, type InsertFeedback } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Language, t } from "@/lib/translations";

interface FeedbackDialogProps {
  language: Language;
}

export default function FeedbackDialog({ language }: FeedbackDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<InsertFeedback>({
    resolver: zodResolver(insertFeedbackSchema),
    defaultValues: {
      issueType: "",
      description: "",
    },
  });

  const issueCategories = [
    {
      value: "wrong_identification",
      translationKey: "wrongAiIdentification",
      icon: AlertCircle
    },
    {
      value: "image_upload",
      translationKey: "imageUploadIssues",
      icon: ImageOff
    },
    {
      value: "translation",
      translationKey: "translationIssues",
      icon: Languages
    },
    {
      value: "other",
      translationKey: "other",
      icon: FileText
    }
  ];

  const onSubmit = async (data: InsertFeedback) => {
    console.log("Form submitted with data:", data);
    console.log("Form validation state:", form.formState.errors);
    
    try {
      console.log("Sending POST request to /api/feedback...");
      await apiRequest("POST", "/api/feedback", data);
      console.log("Feedback submitted successfully!");

      toast({
        title: t("feedbackSubmitted", language),
        description: t("feedbackThankYou", language),
      });

      setOpen(false);
      form.reset();
    } catch (error) {
      console.error("Error submitting feedback:", error);
      toast({
        title: t("submissionFailed", language),
        description: t("unableToSubmit", language),
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open, form]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button 
          variant="secondary" 
          size="sm" 
          className="gap-2 bg-white/90 text-emerald-800 hover:bg-white border border-white/50 shadow-md font-semibold"
          data-testid="button-report-issue"
        >
          <MessageSquare className="h-4 w-4" />
          {t("reportIssue", language)}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]" data-testid="dialog-feedback">
        <DialogHeader>
          <DialogTitle data-testid="text-dialog-title">
            {t("reportIssue", language)}
          </DialogTitle>
          <DialogDescription data-testid="text-dialog-description">
            {t("helpUsImprove", language)}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="issueType"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>
                    {t("issueType", language)}
                  </FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="space-y-2"
                    >
                      {issueCategories.map((category) => {
                        const Icon = category.icon;
                        return (
                          <div key={category.value} className="flex items-center space-x-2">
                            <RadioGroupItem 
                              value={category.value} 
                              id={category.value}
                              data-testid={`radio-${category.value}`}
                            />
                            <Label 
                              htmlFor={category.value} 
                              className="flex items-center gap-2 cursor-pointer font-normal"
                            >
                              <Icon className="h-4 w-4 text-muted-foreground" />
                              <span>{t(category.translationKey, language)}</span>
                            </Label>
                          </div>
                        );
                      })}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("description", language)}
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("descriptionPlaceholder", language)}
                      rows={5}
                      data-testid="textarea-description"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button 
                type="button"
                variant="outline" 
                onClick={() => setOpen(false)}
                data-testid="button-cancel"
              >
                {t("cancel", language)}
              </Button>
              <Button 
                type="submit"
                disabled={form.formState.isSubmitting}
                data-testid="button-submit-feedback"
              >
                {form.formState.isSubmitting
                  ? t("submitting", language) 
                  : t("submit", language)}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
