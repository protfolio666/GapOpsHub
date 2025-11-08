import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { formTemplateApi, gapApi } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import DynamicFormRenderer from "@/components/DynamicFormRenderer";
import type { FormTemplate } from "@shared/schema";

interface FormSchema {
  sections: any[];
  version?: string;
}

interface FormResponses {
  [sectionId: string]: {
    [questionId: string]: any;
  };
}

export default function GapSubmissionForm() {
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [formResponses, setFormResponses] = useState<FormResponses>({});
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // Fetch active form templates
  const { data: templatesData, isLoading: loadingTemplates } = useQuery({
    queryKey: ["/api/form-templates"],
    queryFn: () => formTemplateApi.getAll(true),
  });

  // Fetch selected template details
  const { data: templateData } = useQuery({
    queryKey: ["/api/form-templates", selectedTemplateId],
    queryFn: async () => {
      if (!selectedTemplateId) return null;
      const response = await fetch(`/api/form-templates/${selectedTemplateId}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error("Failed to load template");
      return response.json();
    },
    enabled: !!selectedTemplateId,
  });

  const submitGapMutation = useMutation({
    mutationFn: async (data: {
      templateId: number;
      templateVersion: string;
      responses: FormResponses;
      title: string;
      description: string;
      attachments: any[];
    }) => {
      const response = await fetch("/api/gaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          formTemplateId: data.templateId,
          templateVersion: data.templateVersion,
          formResponsesJson: data.responses,
          title: data.title,
          description: data.description,
          status: "PendingAI",
          priority: "Medium",
          attachments: data.attachments,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to submit gap");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/gaps"] });
      toast({
        title: "Gap Submitted",
        description: "Your gap has been submitted for AI review.",
      });
      navigate("/qa");
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Submission Failed",
        description: error.message || "Failed to submit gap. Please try again.",
      });
    },
  });

  const handleSubmit = () => {
    if (!selectedTemplateId || !templateData) {
      toast({
        variant: "destructive",
        title: "Template Required",
        description: "Please select a form template.",
      });
      return;
    }

    const schema = templateData.template.schemaJson as FormSchema;
    
    // Validate required fields, accounting for visibility and repeatable sections
    let missingFields: string[] = [];
    
    schema.sections.forEach(section => {
      // Check if section is visible
      const isSectionVisible = (section: any) => {
        if (!section.controlledBy) return true;
        
        // Find controlling question in any section
        for (const s of schema.sections) {
          const controllingQuestion = s.questions.find((q: any) => 
            q.controlsSection && q.controlledSectionId === section.id
          );
          
          if (controllingQuestion) {
            const controllerValue = formResponses[s.id]?.[controllingQuestion.id];
            const visibleValues = controllingQuestion.visibleOnValues || [];
            return visibleValues.includes(controllerValue);
          }
        }
        return true;
      };
      
      if (!isSectionVisible(section)) return; // Skip hidden sections
      
      // Handle repeatable sections - check all instances
      const isRepeatable = section.isRepeatable;
      const instanceCount = isRepeatable ? 
        Object.keys(formResponses).filter(key => key.startsWith(section.id)).length || 1 
        : 1;
      
      for (let instanceIndex = 0; instanceIndex < instanceCount; instanceIndex++) {
        section.questions.forEach((question: any) => {
          // Check if question is visible
          const isQuestionVisible = () => {
            if (!question.controlledBy) return true;
            
            const sectionKey = instanceIndex > 0 ? `${section.id}_${instanceIndex}` : section.id;
            const controllerValue = formResponses[sectionKey]?.[question.controlledBy];
            const visibleValues = question.visibleOnValues || [];
            
            return visibleValues.includes(controllerValue);
          };
          
          if (!question.required || !isQuestionVisible()) return; // Skip non-required or hidden
          
          const sectionKey = instanceIndex > 0 ? `${section.id}_${instanceIndex}` : section.id;
          const sectionResponses = formResponses[sectionKey];
          
          // Check main question response
          if (!sectionResponses || !sectionResponses[question.id]) {
            missingFields.push(`${section.name} - ${question.text}`);
          }
          
          // For nested dropdowns, check all required levels
          if (question.type === "dropdown" && question.nestedDropdowns) {
            const level1 = sectionResponses?.[`${question.id}_l1`];
            if (!level1) {
              missingFields.push(`${section.name} - ${question.text} (Level 1)`);
            }
          }
        });
      }
    });

    if (missingFields.length > 0) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: `Please fill in all required fields: ${missingFields.slice(0, 3).join(", ")}${missingFields.length > 3 ? "..." : ""}`,
      });
      return;
    }

    // Generate title and description from form responses
    const firstTextQuestion = schema.sections[0]?.questions.find((q: any) => q.type === "text");
    const title = firstTextQuestion 
      ? formResponses[schema.sections[0].id]?.[firstTextQuestion.id] || "Untitled Gap"
      : "Untitled Gap";

    // Extract file attachments from formResponses
    const attachments: any[] = [];
    Object.entries(formResponses).forEach(([sectionKey, sectionData]) => {
      Object.entries(sectionData).forEach(([questionId, value]) => {
        // Check if value is a file upload object
        if (value && typeof value === 'object' && value.originalName && value.path) {
          attachments.push(value);
        }
      });
    });

    // Combine all text responses for description (excluding file objects)
    let description = "";
    schema.sections.forEach(section => {
      section.questions.forEach((question: any) => {
        const response = formResponses[section.id]?.[question.id];
        if (response && !(typeof response === 'object' && response.originalName)) {
          description += `**${question.text}:** ${response}\n\n`;
        }
      });
    });

    submitGapMutation.mutate({
      templateId: selectedTemplateId,
      templateVersion: schema.version || "1.0",
      responses: formResponses,
      title,
      description: description || "Gap submitted via form template",
      attachments,
    });
  };

  const templates = templatesData?.templates || [];
  const selectedTemplate = templateData?.template as FormTemplate | null;
  const schema = selectedTemplate?.schemaJson as FormSchema | null;

  return (
    <div className="max-w-5xl mx-auto space-y-6" data-testid="page-gap-submission">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Submit Process Gap</h1>
        <p className="text-sm text-muted-foreground">Report a process gap using a form template</p>
      </div>

      {/* Template Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Select Form Template</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Form Template *</Label>
            {loadingTemplates ? (
              <p className="text-sm text-muted-foreground">Loading templates...</p>
            ) : templates.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No active form templates available. Please contact management to create templates.
                </AlertDescription>
              </Alert>
            ) : (
              <Select 
                value={selectedTemplateId?.toString() || ""} 
                onValueChange={(value) => {
                  setSelectedTemplateId(Number(value));
                  setFormResponses({}); // Reset responses when template changes
                }}
              >
                <SelectTrigger data-testid="select-template">
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template: FormTemplate) => {
                    const templateSchema = template.schemaJson as FormSchema;
                    const questionCount = templateSchema.sections?.reduce(
                      (sum, s) => sum + s.questions.length, 
                      0
                    ) || 0;
                    
                    return (
                      <SelectItem key={template.id} value={template.id.toString()}>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          <span>{template.name}</span>
                          <span className="text-xs text-muted-foreground">
                            ({templateSchema.sections?.length || 0} sections, {questionCount} questions)
                          </span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}
          </div>

          {selectedTemplate && (
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm font-medium mb-1">{selectedTemplate.name}</p>
              {selectedTemplate.description && (
                <p className="text-xs text-muted-foreground">{selectedTemplate.description}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dynamic Form Renderer */}
      {schema && (
        <>
          <DynamicFormRenderer
            schema={schema}
            onResponsesChange={setFormResponses}
            initialResponses={formResponses}
          />

          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-4">
                <Button 
                  onClick={handleSubmit}
                  disabled={submitGapMutation.isPending}
                  className="flex-1"
                  data-testid="button-submit-gap"
                >
                  {submitGapMutation.isPending ? "Submitting..." : "Submit Gap"}
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => navigate("/qa")}
                  disabled={submitGapMutation.isPending}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!schema && selectedTemplateId && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Loading form template...
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
