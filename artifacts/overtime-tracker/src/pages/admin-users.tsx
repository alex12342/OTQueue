import React, { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { Users, Shield, Search, Trash2, Edit2, Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { customFetch } from "@workspace/api-client-react";
import { getUserRole } from "@/lib/auth";

interface User {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
  isActive: boolean;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [viewingDetails, setViewingDetails] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createFormError, setCreateFormError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await customFetch<User[]>("/api/admin/users", {
        method: "GET",
      });
      setUsers(data);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const userRole = getUserRole();
    if (userRole !== "admin") {
      window.location.href = "/login";
      return;
    }
    fetchUsers();
  }, []);

  const findUser = (userId: string): User | undefined => {
    return users.find(u => u.id === userId);
  };

  const handleToggleActive = async (userId: string) => {
    const user = findUser(userId);
    if (!user) return;
    
    try {
      await customFetch<void>(`/api/admin/users/${userId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      fetchUsers();
    } catch (error) {
      console.error("Error toggling status:", error);
    }
  };

  const handleDelete = async (userId: string) => {
    setDeleteConfirm(userId);
  };

  const confirmDelete = async (userId: string) => {
    try {
      await customFetch<void>(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });
      fetchUsers();
    } catch (error) {
      console.error("Error deleting user:", error);
    }
  };

  const handleCreateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const name = formData.get("name") as string;
    
    if (!email || !password || !name) {
      return;
    }
    
    try {
      await customFetch<void>("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ email, password, name }),
      });
      fetchUsers();
    } catch (error) {
      console.error("Error creating user:", error);
    }
  };

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Users className="h-8 w-8 text-primary" />
            User Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Create, edit, and manage system users
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(!showCreateForm)}>
          {showCreateForm ? "Cancel" : "Create New User"}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="p-3 rounded-full bg-primary/10 text-primary">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Total Users</div>
              <div className="text-2xl font-bold">{users.length}</div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="p-3 rounded-full bg-green-100 text-green-600">
              <Eye className="h-6 w-6" />
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Active Users</div>
              <div className="text-2xl font-bold">{users.filter(u => u.isActive).length}</div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="p-3 rounded-full bg-purple-100 text-purple-600">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Admin Users</div>
              <div className="text-2xl font-bold">{users.filter(u => u.role === "admin").length}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create User Form */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create New User</CardTitle>
            <CardDescription>Add a new user to the system</CardDescription>
          </CardHeader>
          <CardContent>
            {createFormError && (
              <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                {createFormError}
              </div>
            )}
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <Input name="name" required placeholder="Full name" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input name="email" type="email" required placeholder="name@example.com" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Password</label>
                <Input name="password" type="password" required placeholder="At least 12 characters" minLength={12} />
              </div>
              <Button type="submit" className="w-full">Create User</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* User List */}
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>View and manage all system users</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by email or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11 border-border bg-background"
              />
            </div>

            {/* Users Table */}
            <div className="space-y-2">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-md" />
                ))
              ) : filteredUsers.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No users found. Create a new user above.
                </div>
              ) : (
                filteredUsers.map((user) => (
                  <div 
                    key={user.id} 
                    className="flex items-center justify-between p-4 border rounded-md hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-full ${
                        user.role === "admin" 
                          ? "bg-purple-100 text-purple-600" 
                          : "bg-blue-100 text-blue-600"
                      }`}>
                        {user.role === "admin" ? <Shield className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                      </div>
                      <div>
                        <div className="font-medium">{user.name}</div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                        {viewingDetails && selectedUser?.id === user.id && (
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant={user.role === "admin" ? "outline" : "default"}>
                              {user.role}
                            </Badge>
                            <span>{new Date().toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      {/* Active Switch */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Active:</span>
                        <Switch 
                          checked={user.isActive} 
                          onCheckedChange={() => handleToggleActive(user.id)}
                        />
                      </div>

                      {/* View Details */}
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => {
                          setSelectedUser(user);
                          setViewingDetails(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>

                      {/* Delete Button */}
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(user.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>

                      {/* Close Details Modal */}
                      {viewingDetails && (
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => setViewingDetails(false)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* User Details Modal */}
      {viewingDetails && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>User Details</CardTitle>
              <CardDescription>{selectedUser.name}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Role:</label>
                <Badge variant={selectedUser.role === "admin" ? "outline" : "default"}>
                  {selectedUser.role}
                </Badge>
              </div>
              
              <div className="grid gap-2">
                <label className="text-sm font-medium">Email:</label>
                <div>{selectedUser.email}</div>
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Status:</label>
                <div className={`px-3 py-1 rounded-full text-sm ${
                  selectedUser.isActive 
                    ? "bg-green-100 text-green-700" 
                    : "bg-red-100 text-red-700"
                }`}>
                  {selectedUser.isActive ? "Active" : "Inactive"}
                </div>
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Last Login:</label>
                <div className="text-muted-foreground">Not available</div>
              </div>

              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setViewingDetails(false)}
              >
                Close
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this user? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirm) {
                  confirmDelete(deleteConfirm);
                  setDeleteConfirm(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
