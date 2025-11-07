import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PlusCircle, Trash2, Copy, Save, FileText, Eye, GripVertical, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { FormTemplate } from "@shared/schema";

// Helper function to generate IDs
const generateId = (prefix: string) => `${prefix}_${Math.random().toString(36).substr(2, 9)}`;

interface Question {
  id: string;
  text: string;
  type: "text" | "number" | "dropdown" | "multiSelect" | "date" | "file";
  options?: string; // Comma-separated for dropdown/multiSelect
  required: boolean;
  conditionalOn?: {
    questionId: string;
    showWhen: string[]; // Values that trigger showing this question
  };
}

interface Section {
  id: string;
  name: string;
  questions: Question[];
  isRepeatable?: boolean;
}

interface FormSchema {
  sections: Section[];
}

export default function FormBuilderPage() {
  const [activeTab, setActiveTab] = useState("library");
  const [formName, setFormName] = useState("New Form Template");
  const [formDescription, setFormDescription] = useState("");
  const [currentFormId, setCurrentFormId] = useState<number | null>(null);
  const [formSections, setFormSections] = useState<Section[]>([]);
  const [currentSectionId, setCurrentSectionId] = useState<string | null>(null);
  
  // Question form fields
  const [questionText, setQuestionText] = useState("");
  const [questionType, setQuestionType] = useState<Question["type"]>("text");
  const [questionOptions, setQuestionOptions] = useState("");
  const [isRequired, setIsRequired] = useState(true);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  
  // Dialog states
  const [showNewSectionDialog, setShowNewSectionDialog] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  const [duplicateFormName, setDuplicateFormName] = useState("");
  const [templateToDuplicate, setTemplateToDuplicate] = useState<number | null>(null);
  
  const { toast } = useToast();

  // Fetch all form templates
  const { data: templatesData, isLoading: loadingTemplates } = useQuery({
    queryKey: ["/api/form-templates"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/form-templates");
      return response;
    },
  });

  const createTemplateMutation = useMutation({
    mutationFn: (data: { name: string; description: string; schemaJson: FormSchema }) =>
      apiRequest("POST", "/api/form-templates", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/form-templates"] });
      toast({
        title: "Template created",
        description: "Form template has been saved successfully.",
      });
      setActiveTab("library");
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Failed to create template",
        description: "Please try again.",
      });
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: (data: { id: number; updates: any }) =>
      apiRequest("PATCH", `/api/form-templates/${data.id}`, data.updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/form-templates"] });
      toast({
        title: "Template updated",
        description: "Form template has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Failed to update template",
        description: "Please try again.",
      });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/form-templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/form-templates"] });
      toast({
        title: "Template deleted",
        description: "Form template has been deleted successfully.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Failed to delete template",
        description: "Please try again.",
      });
    },
  });

  const duplicateTemplateMutation = useMutation({
    mutationFn: (data: { id: number; name: string }) =>
      apiRequest("POST", `/api/form-templates/${data.id}/duplicate`, { name: data.name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/form-templates"] });
      setShowDuplicateDialog(false);
      setDuplicateFormName("");
      setTemplateToDuplicate(null);
      toast({
        title: "Template duplicated",
        description: "Form template has been duplicated successfully.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Failed to duplicate template",
        description: "Please try again.",
      });
    },
  });

  // Initialize with one empty section
  useEffect(() => {
    if (formSections.length === 0) {
      const initialSection: Section = {
        id: generateId('section'),
        name: "Section 1",
        questions: []
      };
      setFormSections([initialSection]);
      setCurrentSectionId(initialSection.id);
    }
  }, []);

  const addSection = () => {
    if (!newSectionName.trim()) {
      toast({
        variant: "destructive",
        title: "Section name required",
        description: "Please enter a section name.",
      });
      return;
    }

    const newSection: Section = {
      id: generateId('section'),
      name: newSectionName,
      questions: []
    };

    setFormSections([...formSections, newSection]);
    setCurrentSectionId(newSection.id);
    setNewSectionName("");
    setShowNewSectionDialog(false);
  };

  const deleteSection = (sectionId: string) => {
    if (formSections.length <= 1) {
      toast({
        variant: "destructive",
        title: "Cannot delete",
        description: "You must have at least one section.",
      });
      return;
    }

    const updatedSections = formSections.filter(s => s.id !== sectionId);
    setFormSections(updatedSections);
    
    if (currentSectionId === sectionId) {
      setCurrentSectionId(updatedSections[0]?.id || null);
    }
  };

  const addQuestion = () => {
    if (!questionText.trim()) {
      toast({
        variant: "destructive",
        title: "Question text required",
        description: "Please enter a question.",
      });
      return;
    }

    const currentSection = formSections.find(s => s.id === currentSectionId);
    if (!currentSection) return;

    const question: Question = {
      id: editingQuestionId || generateId('question'),
      text: questionText,
      type: questionType,
      options: (questionType === "dropdown" || questionType === "multiSelect") ? questionOptions : undefined,
      required: isRequired,
    };

    const updatedSections = formSections.map(section => {
      if (section.id === currentSectionId) {
        if (editingQuestionId) {
          return {
            ...section,
            questions: section.questions.map(q => q.id === editingQuestionId ? question : q)
          };
        } else {
          return {
            ...section,
            questions: [...section.questions, question]
          };
        }
      }
      return section;
    });

    setFormSections(updatedSections);
    resetQuestionForm();
  };

  const editQuestion = (questionId: string) => {
    const currentSection = formSections.find(s => s.id === currentSectionId);
    const question = currentSection?.questions.find(q => q.id === questionId);
    
    if (question) {
      setQuestionText(question.text);
      setQuestionType(question.type);
      setQuestionOptions(question.options || "");
      setIsRequired(question.required);
      setEditingQuestionId(questionId);
    }
  };

  const deleteQuestion = (questionId: string) => {
    const updatedSections = formSections.map(section => {
      if (section.id === currentSectionId) {
        return {
          ...section,
          questions: section.questions.filter(q => q.id !== questionId)
        };
      }
      return section;
    });

    setFormSections(updatedSections);
  };

  const resetQuestionForm = () => {
    setQuestionText("");
    setQuestionType("text");
    setQuestionOptions("");
    setIsRequired(true);
    setEditingQuestionId(null);
  };

  const saveTemplate = () => {
    if (!formName.trim()) {
      toast({
        variant: "destructive",
        title: "Form name required",
        description: "Please enter a form name.",
      });
      return;
    }

    if (formSections.length === 0 || formSections.every(s => s.questions.length === 0)) {
      toast({
        variant: "destructive",
        title: "Questions required",
        description: "Please add at least one question to your form.",
      });
      return;
    }

    const schemaJson: FormSchema = {
      sections: formSections
    };

    if (currentFormId) {
      updateTemplateMutation.mutate({
        id: currentFormId,
        updates: {
          name: formName,
          description: formDescription,
          schemaJson,
        }
      });
    } else {
      createTemplateMutation.mutate({
        name: formName,
        description: formDescription,
        schemaJson,
      });
    }
  };

  const loadTemplate = (template: FormTemplate) => {
    setFormName(template.name);
    setFormDescription(template.description || "");
    setCurrentFormId(template.id);
    
    const schema = template.schemaJson as FormSchema;
    setFormSections(schema.sections || []);
    setCurrentSectionId(schema.sections[0]?.id || null);
    setActiveTab("editor");
  };

  const createNewForm = () => {
    setFormName("New Form Template");
    setFormDescription("");
    setCurrentFormId(null);
    const initialSection: Section = {
      id: generateId('section'),
      name: "Section 1",
      questions: []
    };
    setFormSections([initialSection]);
    setCurrentSectionId(initialSection.id);
    setActiveTab("editor");
  };

  const handleDuplicate = (templateId: number) => {
    setTemplateToDuplicate(templateId);
    const template = templatesData?.templates?.find((t: FormTemplate) => t.id === templateId);
    if (template) {
      setDuplicateFormName(`${template.name} (Copy)`);
      setShowDuplicateDialog(true);
    }
  };

  const confirmDuplicate = () => {
    if (!duplicateFormName.trim() || !templateToDuplicate) {
      toast({
        variant: "destructive",
        title: "Name required",
        description: "Please enter a name for the duplicate.",
      });
      return;
    }

    duplicateTemplateMutation.mutate({
      id: templateToDuplicate,
      name: duplicateFormName
    });
  };

  const currentSection = formSections.find(s => s.id === currentSectionId);
  const templates = templatesData?.templates || [];

  return (
    <div className="space-y-6" data-testid="page-form-builder">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Form Builder</h1>
          <p className="text-sm text-muted-foreground">Design custom form templates for gap submission</p>
        </div>
        <Button onClick={createNewForm} data-testid="button-new-form">
          <PlusCircle className="h-4 w-4 mr-2" />
          New Form
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="library" data-testid="tab-library">Library</TabsTrigger>
          <TabsTrigger value="editor" data-testid="tab-editor">Editor</TabsTrigger>
          <TabsTrigger value="preview" data-testid="tab-preview">Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="library" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Form Templates</CardTitle>
              <CardDescription>Manage your form templates</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingTemplates ? (
                <p className="text-sm text-muted-foreground">Loading templates...</p>
              ) : templates.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground mb-4">No templates yet</p>
                  <Button onClick={createNewForm}>Create your first template</Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {templates.map((template: FormTemplate) => {
                    const schema = template.schemaJson as FormSchema;
                    const totalQuestions = schema.sections?.reduce((acc, s) => acc + s.questions.length, 0) || 0;
                    
                    return (
                      <Card key={template.id} className="hover-elevate" data-testid={`card-template-${template.id}`}>
                        <CardHeader>
                          <CardTitle className="text-base">{template.name}</CardTitle>
                          {template.description && (
                            <CardDescription className="text-xs line-clamp-2">{template.description}</CardDescription>
                          )}
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex gap-2">
                            <Badge variant="secondary">{schema.sections?.length || 0} sections</Badge>
                            <Badge variant="secondary">{totalQuestions} questions</Badge>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="flex-1"
                              onClick={() => loadTemplate(template)}
                              data-testid={`button-edit-${template.id}`}
                            >
                              <FileText className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleDuplicate(template.id)}
                              data-testid={`button-duplicate-${template.id}`}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => deleteTemplateMutation.mutate(template.id)}
                              data-testid={`button-delete-${template.id}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="editor" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Form Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Form Name</Label>
                <Input 
                  value={formName} 
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Enter form name"
                  data-testid="input-form-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea 
                  value={formDescription} 
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Enter form description"
                  data-testid="input-form-description"
                />
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Sections</CardTitle>
                  <Button 
                    size="sm" 
                    onClick={() => setShowNewSectionDialog(true)}
                    data-testid="button-add-section"
                  >
                    <PlusCircle className="h-4 w-4 mr-1" />
                    Add Section
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {formSections.map((section) => (
                  <div 
                    key={section.id}
                    className={`p-3 rounded-md border cursor-pointer ${
                      currentSectionId === section.id ? 'bg-accent' : 'hover-elevate'
                    }`}
                    onClick={() => setCurrentSectionId(section.id)}
                    data-testid={`section-${section.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{section.name}</span>
                        <Badge variant="secondary" className="text-xs">{section.questions.length}</Badge>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSection(section.id);
                        }}
                        data-testid={`button-delete-section-${section.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  {currentSection ? `${currentSection.name} - Questions` : "Questions"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Question Text</Label>
                    <Input 
                      value={questionText}
                      onChange={(e) => setQuestionText(e.target.value)}
                      placeholder="Enter question text"
                      data-testid="input-question-text"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Question Type</Label>
                    <Select value={questionType} onValueChange={(value: any) => setQuestionType(value)}>
                      <SelectTrigger data-testid="select-question-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Text</SelectItem>
                        <SelectItem value="number">Number</SelectItem>
                        <SelectItem value="dropdown">Dropdown</SelectItem>
                        <SelectItem value="multiSelect">Multi-Select</SelectItem>
                        <SelectItem value="date">Date</SelectItem>
                        <SelectItem value="file">File Upload</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {(questionType === "dropdown" || questionType === "multiSelect") && (
                    <div className="space-y-2">
                      <Label>Options (comma-separated)</Label>
                      <Input 
                        value={questionOptions}
                        onChange={(e) => setQuestionOptions(e.target.value)}
                        placeholder="Option 1, Option 2, Option 3"
                        data-testid="input-question-options"
                      />
                    </div>
                  )}

                  <div className="flex items-center space-x-2">
                    <Switch 
                      checked={isRequired}
                      onCheckedChange={setIsRequired}
                      data-testid="switch-required"
                    />
                    <Label>Required</Label>
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      onClick={addQuestion}
                      className="flex-1"
                      data-testid="button-add-question"
                    >
                      {editingQuestionId ? "Update Question" : "Add Question"}
                    </Button>
                    {editingQuestionId && (
                      <Button 
                        variant="outline"
                        onClick={resetQuestionForm}
                        data-testid="button-cancel-edit"
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-2 pt-4 border-t">
                  <Label className="text-sm font-medium">Questions in this section</Label>
                  {currentSection?.questions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No questions yet</p>
                  ) : (
                    currentSection?.questions.map((question, index) => (
                      <div key={question.id} className="p-3 rounded-md border hover-elevate">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium mb-1">{index + 1}. {question.text}</p>
                            <div className="flex gap-2">
                              <Badge variant="outline" className="text-xs">{question.type}</Badge>
                              {question.required && <Badge variant="secondary" className="text-xs">Required</Badge>}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => editQuestion(question.id)}
                              data-testid={`button-edit-question-${question.id}`}
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => deleteQuestion(question.id)}
                              data-testid={`button-delete-question-${question.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end">
            <Button 
              onClick={saveTemplate}
              disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}
              data-testid="button-save-template"
            >
              <Save className="h-4 w-4 mr-2" />
              {createTemplateMutation.isPending || updateTemplateMutation.isPending ? "Saving..." : "Save Template"}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="preview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{formName}</CardTitle>
              {formDescription && <CardDescription>{formDescription}</CardDescription>}
            </CardHeader>
            <CardContent className="space-y-6">
              {formSections.map((section, sIndex) => (
                <div key={section.id} className="space-y-4">
                  <h3 className="text-lg font-semibold border-b pb-2">{section.name}</h3>
                  {section.questions.map((question, qIndex) => (
                    <div key={question.id} className="space-y-2">
                      <Label>
                        {qIndex + 1}. {question.text}
                        {question.required && <span className="text-destructive ml-1">*</span>}
                      </Label>
                      {question.type === "text" && (
                        <Input placeholder="Enter your answer" disabled />
                      )}
                      {question.type === "number" && (
                        <Input type="number" placeholder="Enter number" disabled />
                      )}
                      {question.type === "date" && (
                        <Input type="date" disabled />
                      )}
                      {question.type === "dropdown" && (
                        <Select disabled>
                          <SelectTrigger>
                            <SelectValue placeholder="Select an option" />
                          </SelectTrigger>
                          <SelectContent>
                            {question.options?.split(',').map((opt, i) => (
                              <SelectItem key={i} value={opt.trim()}>{opt.trim()}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {question.type === "multiSelect" && (
                        <div className="space-y-2">
                          {question.options?.split(',').map((opt, i) => (
                            <div key={i} className="flex items-center space-x-2">
                              <input type="checkbox" disabled className="h-4 w-4" />
                              <span className="text-sm">{opt.trim()}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {question.type === "file" && (
                        <div className="border-2 border-dashed rounded-md p-4 text-center">
                          <p className="text-sm text-muted-foreground">Click to upload file</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* New Section Dialog */}
      <Dialog open={showNewSectionDialog} onOpenChange={setShowNewSectionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Section</DialogTitle>
            <DialogDescription>Enter a name for the new section</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input 
              value={newSectionName}
              onChange={(e) => setNewSectionName(e.target.value)}
              placeholder="Section name"
              data-testid="input-new-section-name"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewSectionDialog(false)}>
              Cancel
            </Button>
            <Button onClick={addSection} data-testid="button-confirm-add-section">
              Add Section
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate Dialog */}
      <Dialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicate Template</DialogTitle>
            <DialogDescription>Enter a name for the duplicate template</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input 
              value={duplicateFormName}
              onChange={(e) => setDuplicateFormName(e.target.value)}
              placeholder="Template name"
              data-testid="input-duplicate-name"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDuplicateDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={confirmDuplicate}
              disabled={duplicateTemplateMutation.isPending}
              data-testid="button-confirm-duplicate"
            >
              {duplicateTemplateMutation.isPending ? "Duplicating..." : "Duplicate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
