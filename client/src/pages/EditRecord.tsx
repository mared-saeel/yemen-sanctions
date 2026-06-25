import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Loader2, ArrowLeft, Save } from "lucide-react";

export default function EditRecord() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Fetch record details
  const { data: record, isLoading } = trpc.search.getRecord.useQuery(
    { id: parseInt(id!) },
    { enabled: !!id }
  );

  // Update mutation
  const updateMutation = trpc.admin.updateSanctionRecord.useMutation();

  // Form state
  const [formData, setFormData] = useState({
    nameEn: "",
    nameAr: "",
    entityType: "unspecified",
    listingDate: "",
    listingReason: "",
    issuingBody: "",
    legalBasis: "",
    actionTaken: "",
    nationality: "",
    dateOfBirth: "",
    placeOfBirth: "",
    notes: "",
    referenceNumber: "",
  });

  // Load record data into form
  useEffect(() => {
    if (record) {
      setFormData({
        nameEn: record.nameEn || "",
        nameAr: record.nameAr || "",
        entityType: record.entityType || "unspecified",
        listingDate: record.listingDate || "",
        listingReason: record.listingReason || "",
        issuingBody: record.issuingBody || "",
        legalBasis: record.legalBasis || "",
        actionTaken: record.actionTaken || "",
        nationality: record.nationality || "",
        dateOfBirth: record.dateOfBirth || "",
        placeOfBirth: record.placeOfBirth || "",
        notes: record.notes || "",
        referenceNumber: record.referenceNumber || "",
      });
    }
  }, [record]);

  // Check admin permission
  if (!user?.role || user.role !== "admin") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 max-w-md">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p className="text-foreground mb-6">
            Only administrators can edit records.
          </p>
          <Button onClick={() => navigate("/search")} className="w-full">
            Back to Search
          </Button>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!record) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 max-w-md">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Record Not Found</h1>
          <Button onClick={() => navigate("/search")} className="w-full">
            Back to Search
          </Button>
        </Card>
      </div>
    );
  }

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    try {
      setError("");
      setSuccess("");
      setIsSaving(true);

      await updateMutation.mutateAsync({
        id: parseInt(id!),
        nameEn: formData.nameEn || undefined,
        nameAr: formData.nameAr || undefined,
        entityType: formData.entityType as any,
        listingDate: formData.listingDate || undefined,
        listingReason: formData.listingReason || undefined,
        issuingBody: formData.issuingBody || undefined,
        legalBasis: formData.legalBasis || undefined,
        actionTaken: formData.actionTaken || undefined,
        nationality: formData.nationality || undefined,
        dateOfBirth: formData.dateOfBirth || undefined,
        placeOfBirth: formData.placeOfBirth || undefined,
        notes: formData.notes || undefined,
        referenceNumber: formData.referenceNumber || undefined,
      });

      setSuccess("Record updated successfully!");
      setTimeout(() => {
        navigate(`/record/${id}`);
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Failed to update record");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/record/${id}`)}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-3xl font-bold text-foreground">Edit Record</h1>
          </div>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <Card className="p-4 mb-6 bg-red-50 border-red-200">
            <p className="text-red-700">{error}</p>
          </Card>
        )}
        {success && (
          <Card className="p-4 mb-6 bg-green-50 border-green-200">
            <p className="text-green-700">{success}</p>
          </Card>
        )}

        {/* Form */}
        <Card className="p-6 space-y-6">
          {/* Names Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                English Name
              </label>
              <Input
                value={formData.nameEn}
                onChange={(e) => handleChange("nameEn", e.target.value)}
                placeholder="Enter English name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Arabic Name
              </label>
              <Input
                value={formData.nameAr}
                onChange={(e) => handleChange("nameAr", e.target.value)}
                placeholder="أدخل الاسم العربي"
                dir="rtl"
              />
            </div>
          </div>

          {/* Entity Type */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Entity Type
            </label>
            <select
              value={formData.entityType}
              onChange={(e) => handleChange("entityType", e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
            >
              <option value="individual">Individual</option>
              <option value="organisation">Organisation</option>
              <option value="vessel">Vessel</option>
              <option value="unspecified">Unspecified</option>
            </select>
          </div>

          {/* Listing Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Listing Date
              </label>
              <Input
                value={formData.listingDate}
                onChange={(e) => handleChange("listingDate", e.target.value)}
                placeholder="e.g., 2023-01-15"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Issuing Body
              </label>
              <Input
                value={formData.issuingBody}
                onChange={(e) => handleChange("issuingBody", e.target.value)}
                placeholder="e.g., OFAC, EU"
              />
            </div>
          </div>

          {/* Listing Reason */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Listing Reason
            </label>
            <Textarea
              value={formData.listingReason}
              onChange={(e) => handleChange("listingReason", e.target.value)}
              placeholder="Enter listing reason"
              rows={3}
            />
          </div>

          {/* Legal Basis */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Legal Basis
            </label>
            <Input
              value={formData.legalBasis}
              onChange={(e) => handleChange("legalBasis", e.target.value)}
              placeholder="Enter legal basis"
            />
          </div>

          {/* Action Taken */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Action Taken
            </label>
            <Textarea
              value={formData.actionTaken}
              onChange={(e) => handleChange("actionTaken", e.target.value)}
              placeholder="Enter action taken"
              rows={3}
            />
          </div>

          {/* Personal Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Nationality
              </label>
              <Input
                value={formData.nationality}
                onChange={(e) => handleChange("nationality", e.target.value)}
                placeholder="Enter nationality"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Date of Birth
              </label>
              <Input
                value={formData.dateOfBirth}
                onChange={(e) => handleChange("dateOfBirth", e.target.value)}
                placeholder="e.g., 1980-05-15"
              />
            </div>
          </div>

          {/* Place of Birth */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Place of Birth
            </label>
            <Input
              value={formData.placeOfBirth}
              onChange={(e) => handleChange("placeOfBirth", e.target.value)}
              placeholder="Enter place of birth"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Notes
            </label>
            <Textarea
              value={formData.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              placeholder="Enter notes"
              rows={4}
            />
          </div>

          {/* Reference Number */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Reference Number
            </label>
            <Input
              value={formData.referenceNumber}
              onChange={(e) => handleChange("referenceNumber", e.target.value)}
              placeholder="Enter reference number"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-6 border-t border-border">
            <Button
              variant="outline"
              onClick={() => navigate(`/record/${id}`)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
